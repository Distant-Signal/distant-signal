#!/usr/bin/env python3
# ruff: noqa: T201  # a CLI whose output is stdout
"""Seed frontend/e2e/fixtures/seed.sql as if run at several clocks and check
that the missed-train fixtures (DS-534) hold whatever the hour.

  PGHOST=... uv run scripts/check-e2e-seed-clock.py --template ds_tpl

journey-missed-train.spec.ts needs, whenever the suite runs: journey 900401's
leg finished and inside its miss window, and the trains E2EMS2 and E2EMS3,
hours ahead, in the timetable the api searches for it. The api searches the
leg's own service date, and the next one only once the clock is past that
date's midnight (ds-api's `ReplanQuery::next_date_searched`: 1440 minutes or
more), so a train hours ahead that falls on the next date is not found before
midnight. This runs the seed once per clock (`e2e.now`, which the seed's
missed-train section reads in place of NOW()) in a throwaway database cloned
from a migrated template, then checks each fixture against the api's rule at
the seeding instant and again after a suite's worth of minutes.

Needs a migrated template database (ds-migrate at the api's core-version) and
the libpq environment (PGHOST, PGPORT, PGUSER, ...) of a role that can create
databases. Exit status 1 when any clock leaves the spec unable to pass.
Stdlib only.
"""

import argparse
import json
import os
import subprocess
import sys
from collections.abc import Sequence
from dataclasses import dataclass
from datetime import datetime, timedelta
from pathlib import Path

SEED = Path(__file__).resolve().parent.parent / "frontend" / "e2e" / "fixtures" / "seed.sql"

# Instants the seed is run at. London is UTC in winter and an hour ahead in
# summer; the set covers the hours before midnight (four hours on is the next
# date), just after it, and the early morning, in both.
CLOCKS: tuple[str, ...] = (
    "2026-11-18T23:40:00Z",
    "2026-11-18T20:30:00Z",
    "2026-11-19T00:10:00Z",
    "2026-11-19T03:30:00Z",
    "2026-11-19T12:00:00Z",
    "2026-07-14T22:40:00Z",
    "2026-07-14T19:10:00Z",
    "2026-07-14T23:10:00Z",
    "2026-07-15T02:30:00Z",
)
# A suite runs for about this long after the seeding: checked at both ends.
RUN_AFTER_MINUTES: tuple[int, ...] = (1, 40)

# What the api reads of the fixture at `{at}`: the minutes since the leg's
# service date began in London, whether its miss window (until 04:00 London
# the morning after) is open, and where the fixture trains are timetabled.
FACTS_SQL = """
WITH leg AS (
  SELECT service_date FROM journey_legs WHERE journey_id = 900401
)
SELECT json_build_object(
  'minute_of_leg_date', (
    SELECT (EXTRACT(EPOCH FROM ('{at}'::timestamptz AT TIME ZONE 'Europe/London'
                                - leg.service_date::timestamp)) / 60)::int FROM leg),
  'window_open', (
    SELECT '{at}'::timestamptz
           < ((leg.service_date + 1)::timestamp + interval '4 hours') AT TIME ZONE 'Europe/London'
    FROM leg),
  'leg_arrived', EXISTS (
    SELECT 1 FROM train_movement_events e
    WHERE e.dedup_key = 'FIXTURE-E2EMS1-ARR' AND e.actual_timestamp <= '{at}'::timestamptz),
  'leg_date', (SELECT service_date FROM leg),
  'trains', (
    SELECT COALESCE(json_object_agg(uid, json_build_object(
      'date', service_date,
      'minute', EXTRACT(EPOCH FROM booked_departure) / 60 + day_offset * 1440)), '{{}}'::json)
    FROM schedule_calling_points_full
    WHERE uid IN ('E2EMS2', 'E2EMS3') AND seq = 0)
)
"""


@dataclass(frozen=True)
class Facts:
    minute_of_leg_date: int
    window_open: bool
    leg_arrived: bool
    leg_date: str
    trains: dict[str, tuple[str, float]]  # uid -> (service date, departure minute)


def parse_facts(raw: str) -> Facts:
    data = json.loads(raw)
    trains = {uid: (str(t["date"]), float(t["minute"])) for uid, t in data["trains"].items()}
    return Facts(
        minute_of_leg_date=int(data["minute_of_leg_date"]),
        window_open=bool(data["window_open"]),
        leg_arrived=bool(data["leg_arrived"]),
        leg_date=str(data["leg_date"]),
        trains=trains,
    )


def next_date(date: str) -> str:
    return (datetime.fromisoformat(date) + timedelta(days=1)).date().isoformat()


def problems(facts: Facts) -> list[str]:
    """What stops the spec passing at the instant `facts` describes, by the
    api's rules: the miss window, the leg having arrived, and the dates a
    journey's alternatives search covers."""
    found: list[str] = []
    if not facts.window_open:
        found.append("the miss window is closed")
    if not facts.leg_arrived:
        found.append("the leg has not arrived")
    searched = [facts.leg_date]
    if facts.minute_of_leg_date >= 1440:
        searched.append(next_date(facts.leg_date))
    for uid in ("E2EMS2", "E2EMS3"):
        train = facts.trains.get(uid)
        if train is None:
            found.append(f"{uid} is not in the timetable")
            continue
        date, minute = train
        if date not in searched:
            found.append(f"{uid} is timetabled on {date}, not on a searched date ({', '.join(searched)})")
        elif (0 if date == facts.leg_date else 1440) + minute < facts.minute_of_leg_date:
            found.append(f"{uid} has already left")
    return found


def psql(args: Sequence[str], *, database: str, env: dict[str, str] | None = None) -> str:
    result = subprocess.run(
        ["psql", "-X", "-v", "ON_ERROR_STOP=1", "-q", "-At", "-d", database, *args],
        capture_output=True,
        text=True,
        check=False,
        env={**os.environ, **(env or {})},
    )
    if result.returncode != 0:
        raise SystemExit(f"psql failed: {result.stderr.strip()}")
    return result.stdout.strip()


def check_clock(template: str, clock: str) -> list[str]:
    name = "seedclock_" + "".join(ch for ch in clock if ch.isdigit())
    psql(["-c", f'DROP DATABASE IF EXISTS "{name}"'], database="postgres")
    psql(["-c", f'CREATE DATABASE "{name}" TEMPLATE "{template}"'], database="postgres")
    try:
        psql(["-o", os.devnull, "-f", str(SEED)], database=name, env={"PGOPTIONS": f"-c e2e.now={clock}"})
        seeded = datetime.fromisoformat(clock)
        failures: list[str] = []
        for minutes in RUN_AFTER_MINUTES:
            at = (seeded + timedelta(minutes=minutes)).isoformat()
            facts = parse_facts(psql(["-c", FACTS_SQL.format(at=at)], database=name))
            failures += [f"{clock} +{minutes}m: {item}" for item in problems(facts)]
        return failures
    finally:
        psql(["-c", f'DROP DATABASE IF EXISTS "{name}"'], database="postgres")


def main(argv: Sequence[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--template", required=True, help="a migrated database to clone per clock")
    parser.add_argument("--clock", action="append", help="seed at this UTC instant (repeatable); default: a set")
    args = parser.parse_args(argv)
    failures: list[str] = []
    for clock in args.clock or CLOCKS:
        found = check_clock(args.template, clock)
        print(f"{clock}: {'ok' if not found else 'FAIL'}")
        failures += found
    for failure in failures:
        print(f"  {failure}", file=sys.stderr)
    return 1 if failures else 0


if __name__ == "__main__":
    raise SystemExit(main())
