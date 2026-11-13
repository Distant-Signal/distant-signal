#!/usr/bin/env python3
# ruff: noqa: T201  # a CLI whose output (the table or JSON) is stdout
"""Check what Cloudflare's edge cache does with the public site.

  uv run scripts/check-edge-cache.py [--base-url URL] [--delay SECONDS]
                                     [--json] [--strict]

Cloudflare adds `cf-cache-status` and `Age` to the response a client gets;
the origin never sees either, so the only way to know whether a caching rule
works is to look from outside. This makes a small number of anonymous GETs
(about thirty with the defaults, one a second, so no load) to the public
site, each route class twice, and prints status, cache-control, age,
cf-cache-status (first and second request), etag and vary with a verdict per
class. docs/edge-caching.md says how to read the result.

Verdicts: PASS (matches the expectation), WARN (does not: usually a caching
rule that is not in place yet, or a header that drifted) and FAIL, the
critical one: something that must never be served from the edge cache was
(a request carrying a session cookie, a response that sets a cookie, or one
whose own cache-control says private or no-store).

Exit status: 0 when nothing failed, 1 on any FAIL (or any WARN with
--strict), 2 when no request got an answer. Read-only: GETs only, no
credentials; the cookie checks send a made-up session cookie value, which
the api rejects as anonymous. Stdlib only.
"""

import argparse
import dataclasses
import enum
import json
import re
import sys
import time
import urllib.error
import urllib.request
from collections.abc import Callable, Mapping, Sequence
from typing import Final, override
from urllib.parse import urljoin, urlsplit

DEFAULT_BASE_URL: Final = "https://ds.cursed.solutions"
DEFAULT_DELAY: Final = 1.0
TIMEOUT: Final = 20.0
USER_AGENT: Final = (
    "distant-signal-check-edge-cache/1 "
    "(+https://github.com/Distant-Signal/distant-signal; read-only, a few GETs)"
)
SESSION_COOKIE: Final = "distant_signal_session=x"
# Enough of the home page to find a build asset link in its head.
MAX_BODY: Final = 262144
ASSET_RE: Final = re.compile(r"/_next/static/[A-Za-z0-9_./~%-]+\.(?:css|js)")
UNCACHEABLE_DIRECTIVES: Final = ("private", "no-store")
MAX_CELL: Final = 44


class Verdict(enum.IntEnum):
    """A check's outcome, ordered so max() picks the worst."""

    PASS = 0
    WARN = 1
    FAIL = 2


class Want(enum.Enum):
    """What the second request's cf-cache-status should be."""

    HIT = "HIT once the cache rule exists"
    NOT_HIT = "not HIT"


class CookieCheck(enum.Enum):
    """What a HIT for a request with a session cookie means for a class."""

    NONE = "none"
    FAIL = "fail"
    WARN = "warn"


@dataclasses.dataclass(frozen=True)
class Reply:
    """One HTTP answer: status, lower-cased headers and a body prefix."""

    status: int
    headers: Mapping[str, str]
    body: bytes = b""


class TransportError(Exception):
    """A request got no HTTP answer (DNS, TLS, timeout, reset)."""


Transport = Callable[[str, Mapping[str, str], bool], Reply]
"""(url, request headers, read a body prefix) to the reply."""


@dataclasses.dataclass(frozen=True)
class RouteClass:
    """A kind of public URL and what the edge should do with it."""

    name: str
    path: str
    want: Want
    cookie: CookieCheck = CookieCheck.NONE
    cache_control_any: tuple[str, ...] = ()
    """If set, the second response's cache-control must contain one of these."""


ROUTE_CLASSES: Final = (
    RouteClass("home html", "/", Want.NOT_HIT, CookieCheck.FAIL),
    RouteClass("line page", "/lines/c2c", Want.NOT_HIT),
    RouteClass("station page", "/stations/EUS", Want.NOT_HIT),
    RouteClass("a to z html", "/transit/tfl/stops", Want.NOT_HIT),
    RouteClass("robots.txt", "/robots.txt", Want.HIT),
    RouteClass("sitemap.xml", "/sitemap.xml", Want.HIT),
    # path is replaced with a real build asset found in the home page.
    RouteClass("next static asset", "/_next/static/", Want.HIT),
    RouteClass(
        "service worker",
        "/sw.js",
        Want.NOT_HIT,
        cache_control_any=("no-cache", "no-store", "max-age=0"),
    ),
    RouteClass("api stations index", "/api/stations/index", Want.HIT, CookieCheck.FAIL),
    RouteClass(
        "api transit networks",
        "/api/transit/networks",
        Want.HIT,
        CookieCheck.FAIL,
    ),
    # The frontend sends no cookie upstream for these, so a cached answer is
    # the same for everyone: a HIT with a cookie is only a WARN.
    RouteClass(
        "public line status",
        "/Line/Mode/tube/Status",
        Want.HIT,
        CookieCheck.WARN,
    ),
)
STATIC_CLASS: Final = "next static asset"


@dataclasses.dataclass(frozen=True)
class Observation:
    """What one request showed, from the client's side of the edge."""

    label: str
    status: int | None = None
    cache_control: str = ""
    age: str = ""
    cf_cache_status: str = ""
    etag: str = ""
    vary: str = ""
    set_cookie: bool = False
    error: str = ""


@dataclasses.dataclass
class ClassResult:
    """A route class's observations, verdict and the reasons for it."""

    route: RouteClass
    path: str
    observations: list[Observation] = dataclasses.field(default_factory=list)
    verdict: Verdict = Verdict.PASS
    notes: list[str] = dataclasses.field(default_factory=list)

    def flag(self, verdict: Verdict, note: str) -> None:
        """Record a finding and raise the verdict to at least `verdict`."""
        self.verdict = max(self.verdict, verdict)
        self.notes.append(f"{verdict.name}: {note}")


def observe(label: str, reply: Reply) -> Observation:
    """Summarise a reply's headers."""
    headers = reply.headers
    return Observation(
        label=label,
        status=reply.status,
        cache_control=headers.get("cache-control", ""),
        age=headers.get("age", ""),
        cf_cache_status=headers.get("cf-cache-status", "").upper(),
        etag=headers.get("etag", ""),
        vary=headers.get("vary", ""),
        set_cookie="set-cookie" in headers,
    )


class _NoRedirect(urllib.request.HTTPRedirectHandler):
    """Report a redirect instead of following it."""

    @override
    def redirect_request(
        self,
        req: urllib.request.Request,
        fp: object,
        code: int,
        msg: str,
        headers: object,
        newurl: str,
    ) -> None:
        return None


def http_transport(url: str, headers: Mapping[str, str], want_body: bool) -> Reply:  # noqa: FBT001  # fixed Transport signature
    """GET `url` for real; never follows a redirect."""
    if urlsplit(url).scheme not in {"http", "https"}:
        msg = f"not an http(s) URL: {url}"
        raise TransportError(msg)
    request = urllib.request.Request(url, headers=dict(headers), method="GET")  # noqa: S310  # scheme checked above
    opener = urllib.request.build_opener(_NoRedirect)
    try:
        response = opener.open(request, timeout=TIMEOUT)
    except urllib.error.HTTPError as err:
        response = err
    except (urllib.error.URLError, OSError) as err:
        raise TransportError(str(err)) from err
    try:
        body = response.read(MAX_BODY) if want_body else b""
        lowered = {key.lower(): value for key, value in response.headers.items()}
        return Reply(status=response.status, headers=lowered, body=body)
    except OSError as err:
        raise TransportError(str(err)) from err
    finally:
        response.close()


def find_static_asset(html: bytes) -> str | None:
    """Return the first /_next/static asset path a page links, if any."""
    match = ASSET_RE.search(html.decode("utf-8", errors="replace"))
    return match.group(0) if match else None


class Checker:
    """Runs the requests, politely, and judges them."""

    def __init__(
        self,
        base_url: str,
        transport: Transport,
        delay: float,
        sleep: Callable[[float], None] = time.sleep,
    ) -> None:
        """Bind the target, the transport and the pause between requests."""
        self.base_url = base_url.rstrip("/") + "/"
        self.transport = transport
        self.delay = delay
        self.sleep = sleep
        self.sent = 0
        self.answered = 0

    def fetch(
        self,
        label: str,
        path: str,
        *,
        cookie: bool = False,
        want_body: bool = False,
    ) -> tuple[Observation, Reply | None]:
        """GET one path (after the politeness delay) and observe it."""
        if self.sent:
            self.sleep(self.delay)
        self.sent += 1
        headers = {
            "User-Agent": USER_AGENT,
            "Accept": "*/*",
            "Accept-Encoding": "identity",
        }
        if cookie:
            headers["Cookie"] = SESSION_COOKIE
        try:
            reply = self.transport(
                urljoin(self.base_url, path.lstrip("/")), headers, want_body
            )
        except TransportError as err:
            return Observation(label=label, error=str(err)), None
        self.answered += 1
        return observe(label, reply), reply

    def check_class(
        self, route: RouteClass, path: str, result: ClassResult
    ) -> Reply | None:
        """Request a class twice, then once with a cookie where it matters."""
        first, first_reply = self.fetch(
            "1st", path, want_body=route.name == "home html"
        )
        second, _ = self.fetch("2nd", path)
        result.observations += [first, second]
        for obs in (first, second):
            if obs.error:
                result.flag(Verdict.WARN, f"{obs.label} request failed: {obs.error}")
        if not second.error:
            judge_second(route, second, result)
        for obs in (first, second):
            judge_always(obs, result)
        if route.cookie is not CookieCheck.NONE:
            cookie_obs, _ = self.fetch("cookie", path, cookie=True)
            result.observations.append(cookie_obs)
            judge_cookie(route, cookie_obs, result)
        return first_reply

    def run(self, only: Sequence[str] = ()) -> list[ClassResult]:
        """Check every route class (or just `only`), home page first."""
        results: list[ClassResult] = []
        asset: str | None = None
        for route in ROUTE_CLASSES:
            if only and route.name not in only:
                continue
            path = route.path
            if route.name == STATIC_CLASS:
                if asset is None:
                    result = ClassResult(route, path)
                    result.flag(
                        Verdict.WARN, "no /_next/static asset found in the home page"
                    )
                    results.append(result)
                    continue
                path = asset
            result = ClassResult(route, path)
            reply = self.check_class(route, path, result)
            if route.name == "home html" and reply is not None:
                asset = find_static_asset(reply.body)
            results.append(result)
        return results


def judge_second(route: RouteClass, obs: Observation, result: ClassResult) -> None:
    """Compare the second request with the class's expectation."""
    if obs.status is not None and obs.status >= 400:  # noqa: PLR2004  # HTTP error class
        result.flag(Verdict.WARN, f"2nd request answered {obs.status}")
    if not obs.cf_cache_status:
        result.flag(
            Verdict.WARN,
            "no cf-cache-status header (not behind Cloudflare, or it was stripped)",
        )
    elif route.want is Want.HIT and obs.cf_cache_status != "HIT":
        result.flag(
            Verdict.WARN,
            f"2nd request was {obs.cf_cache_status}, expected HIT "
            "(is the cache rule in place?)",
        )
    elif route.want is Want.NOT_HIT and obs.cf_cache_status == "HIT":
        result.flag(
            Verdict.WARN, "2nd request was HIT but this class is not meant to be cached"
        )
    if route.cache_control_any:
        lowered = obs.cache_control.lower()
        if not any(token in lowered for token in route.cache_control_any):
            result.flag(
                Verdict.WARN,
                f"cache-control {obs.cache_control or '(none)'!r} has none of "
                f"{', '.join(route.cache_control_any)}",
            )


def judge_always(obs: Observation, result: ClassResult) -> None:
    """Flag the critical cases: a HIT that must never have been one."""
    if obs.cf_cache_status != "HIT":
        return
    if obs.set_cookie:
        result.flag(
            Verdict.FAIL, f"{obs.label} request: HIT for a response that sets a cookie"
        )
    lowered = obs.cache_control.lower()
    if any(token in lowered for token in UNCACHEABLE_DIRECTIVES):
        result.flag(
            Verdict.FAIL,
            f"{obs.label} request: HIT although cache-control says "
            f"{obs.cache_control!r}",
        )


def judge_cookie(route: RouteClass, obs: Observation, result: ClassResult) -> None:
    """Flag a HIT for a request carrying a session cookie."""
    if obs.error:
        result.flag(Verdict.WARN, f"cookie request failed: {obs.error}")
        return
    if obs.cf_cache_status != "HIT":
        return
    if route.cookie is CookieCheck.FAIL:
        result.flag(Verdict.FAIL, "a request with a session cookie was served as HIT")
    else:
        result.flag(
            Verdict.WARN,
            "a request with a session cookie was HIT (fine only while the frontend "
            "sends no cookie upstream for this route)",
        )


def clip(text: str, width: int = MAX_CELL) -> str:
    """Shorten a header value for the table."""
    text = text or "-"
    return text if len(text) <= width else text[: width - 1] + "~"


def pair(first: str, second: str) -> str:
    """Show a first/second header pair."""
    return f"{first or '-'} / {second or '-'}"


def render_table(results: Sequence[ClassResult]) -> str:
    """Return the results as a fixed-width table plus the notes."""
    header = (
        "class",
        "path",
        "status",
        "cache-control",
        "age",
        "cf-cache-status",
        "etag",
        "vary",
        "verdict",
    )
    rows: list[tuple[str, ...]] = []
    for res in results:
        by_label = {obs.label: obs for obs in res.observations}
        first = by_label.get("1st", Observation("1st"))
        second = by_label.get("2nd", Observation("2nd"))
        status = pair(
            "" if first.status is None else str(first.status),
            "" if second.status is None else str(second.status),
        )
        rows.append(
            (
                res.route.name,
                clip(res.path, 36),
                status,
                clip(second.cache_control),
                pair(first.age, second.age),
                pair(first.cf_cache_status, second.cf_cache_status),
                clip(second.etag, 24),
                clip(second.vary, 36),
                res.verdict.name,
            ),
        )
    widths = [max(len(row[i]) for row in [header, *rows]) for i in range(len(header))]
    lines = [
        "  ".join(cell.ljust(widths[i]) for i, cell in enumerate(row)).rstrip()
        for row in [header, *rows]
    ]
    lines.insert(1, "  ".join("-" * w for w in widths))
    cookie_lines = []
    for res in results:
        cookie_obs = [obs for obs in res.observations if obs.label == "cookie"]
        if cookie_obs:
            cookie_lines.append(
                f"  {res.route.name}: cookie request cf-cache-status "
                f"{cookie_obs[0].cf_cache_status or '-'}"
            )
    notes = [f"  {res.route.name}: {note}" for res in results for note in res.notes]
    out = lines
    if cookie_lines:
        out += [
            "",
            "Requests with a session cookie (must never be HIT):",
            *cookie_lines,
        ]
    if notes:
        out += ["", "Findings:", *notes]
    return "\n".join(out)


def to_json(base_url: str, results: Sequence[ClassResult], exit_code: int) -> str:
    """Return the results as a JSON document."""
    document = {
        "base_url": base_url,
        "exit_code": exit_code,
        "results": [
            {
                "class": res.route.name,
                "path": res.path,
                "expect": res.route.want.value,
                "verdict": res.verdict.name,
                "notes": res.notes,
                "requests": [dataclasses.asdict(obs) for obs in res.observations],
            }
            for res in results
        ],
    }
    return json.dumps(document, indent=2)


def exit_code_for(
    results: Sequence[ClassResult], answered: int, *, strict: bool
) -> int:
    """0 clean, 1 a FAIL (or a WARN when strict), 2 no request answered."""
    if answered == 0:
        return 2
    worst = max((res.verdict for res in results), default=Verdict.PASS)
    if worst is Verdict.FAIL or (strict and worst is Verdict.WARN):
        return 1
    return 0


def parse_args(argv: Sequence[str]) -> argparse.Namespace:
    """Parse the command line."""
    parser = argparse.ArgumentParser(
        description=(__doc__ or "").split("\n\n", maxsplit=1)[0]
    )
    parser.add_argument(
        "--base-url",
        default=DEFAULT_BASE_URL,
        help="site to check (default: %(default)s)",
    )
    parser.add_argument(
        "--delay",
        type=float,
        default=DEFAULT_DELAY,
        help="seconds between requests (default: %(default)s; minimum 0.2)",
    )
    parser.add_argument(
        "--json", action="store_true", help="print JSON instead of the table"
    )
    parser.add_argument(
        "--strict", action="store_true", help="exit 1 on a WARN as well as a FAIL"
    )
    parser.add_argument(
        "--only",
        action="append",
        default=[],
        choices=[route.name for route in ROUTE_CLASSES],
        help="check only this class (repeatable; the static asset needs home html too)",
    )
    return parser.parse_args(argv)


def main(
    argv: Sequence[str] | None = None,
    transport: Transport = http_transport,
    sleep: Callable[[float], None] = time.sleep,
) -> int:
    """Run the checks and print the report."""
    args = parse_args(sys.argv[1:] if argv is None else argv)
    if args.delay < 0.2:  # noqa: PLR2004  # the politeness floor
        print("--delay must be at least 0.2 seconds", file=sys.stderr)
        return 2
    if urlsplit(args.base_url).scheme not in {"http", "https"}:
        print("--base-url must be an http(s) URL", file=sys.stderr)
        return 2
    only = list(args.only)
    if STATIC_CLASS in only and "home html" not in only:
        only.append("home html")
    checker = Checker(args.base_url, transport, args.delay, sleep)
    results = checker.run(only)
    code = exit_code_for(results, checker.answered, strict=args.strict)
    if args.json:
        print(to_json(args.base_url, results, code))
    else:
        print(
            f"Edge cache check of {args.base_url} "
            f"({checker.sent} GETs, {args.delay:g}s apart)\n"
        )
        print(render_table(results))
        print(f"\nExit {code}")
    return code


if __name__ == "__main__":
    sys.exit(main())
