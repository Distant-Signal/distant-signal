"""Tests for scripts/check-e2e-seed-clock.py's rule (no database)."""

import importlib.util
import sys
import unittest
from pathlib import Path
from types import ModuleType

SCRIPT = Path(__file__).resolve().parents[1] / "check-e2e-seed-clock.py"


def load() -> ModuleType:
    """Import scripts/check-e2e-seed-clock.py."""
    spec = importlib.util.spec_from_file_location("check_e2e_seed_clock", SCRIPT)
    if spec is None or spec.loader is None:
        msg = f"cannot load {SCRIPT}"
        raise ImportError(msg)
    module = importlib.util.module_from_spec(spec)
    sys.modules["check_e2e_seed_clock"] = module
    spec.loader.exec_module(module)
    return module


clock = load()


def facts(minute: int, trains: dict[str, tuple[str, float]]) -> object:
    """Facts at `minute` of the leg's date, window open and leg arrived."""
    return clock.Facts(
        minute_of_leg_date=minute,
        window_open=True,
        leg_arrived=True,
        leg_date="2026-11-18",
        trains=trains,
    )


class ProblemsTest(unittest.TestCase):
    """The rule the seed's fixtures are checked against."""

    def test_trains_on_the_legs_date_after_the_clock_pass(self) -> None:
        """Trains on the legs date after the clock pass."""
        both = {"E2EMS2": ("2026-11-18", 1660.0), "E2EMS3": ("2026-11-18", 1720.0)}
        self.assertEqual(clock.problems(facts(1427, both)), [])

    def test_the_next_date_is_not_searched_before_midnight(self) -> None:
        """The next date is not searched before midnight."""
        # What the seed did at 23:40: the trains on the next date, which the
        # api does not look at until the clock is past the leg's midnight.
        next_date = {"E2EMS2": ("2026-11-19", 220.0), "E2EMS3": ("2026-11-19", 280.0)}
        found = clock.problems(facts(1427, next_date))
        self.assertEqual(len(found), 2)
        self.assertIn("not on a searched date", found[0])

    def test_the_next_date_is_searched_past_midnight(self) -> None:
        """The next date is searched past midnight."""
        next_date = {"E2EMS2": ("2026-11-19", 220.0), "E2EMS3": ("2026-11-19", 280.0)}
        self.assertEqual(clock.problems(facts(1450, next_date)), [])

    def test_a_train_that_has_left_is_reported(self) -> None:
        """A train that has left is reported."""
        gone = {"E2EMS2": ("2026-11-18", 600.0), "E2EMS3": ("2026-11-18", 1720.0)}
        self.assertEqual(clock.problems(facts(500, gone)), [])
        self.assertEqual(clock.problems(facts(700, gone)), ["E2EMS2 has already left"])

    def test_a_missing_train_a_closed_window_and_an_unarrived_leg_are_reported(
        self,
    ) -> None:
        """A missing train a closed window and an unarrived leg are reported."""
        shut = clock.Facts(
            minute_of_leg_date=100,
            window_open=False,
            leg_arrived=False,
            leg_date="2026-11-18",
            trains={"E2EMS2": ("2026-11-18", 400.0)},
        )
        self.assertEqual(
            clock.problems(shut),
            [
                "the miss window is closed",
                "the leg has not arrived",
                "E2EMS3 is not in the timetable",
            ],
        )

    def test_parse_facts_reads_the_database_json(self) -> None:
        """Parse facts reads the database json."""
        raw = (
            '{"minute_of_leg_date": 1427, "window_open": true, "leg_arrived": true,'
            ' "leg_date": "2026-11-18",'
            ' "trains": {"E2EMS2": {"date": "2026-11-18", "minute": 1660.0}}}'
        )
        parsed = clock.parse_facts(raw)
        self.assertEqual(parsed.trains, {"E2EMS2": ("2026-11-18", 1660.0)})
        self.assertEqual(parsed.minute_of_leg_date, 1427)


if __name__ == "__main__":
    unittest.main()
