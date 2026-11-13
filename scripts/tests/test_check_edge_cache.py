"""Tests for scripts/check-edge-cache.py with a fake transport (no network)."""

import importlib.util
import io
import json
import sys
import unittest
from collections.abc import Callable, Mapping
from contextlib import redirect_stdout
from pathlib import Path
from types import ModuleType
from typing import Any
from urllib.parse import urlsplit

SCRIPT = Path(__file__).resolve().parents[1] / "check-edge-cache.py"


def load() -> ModuleType:
    """Import scripts/check-edge-cache.py."""
    spec = importlib.util.spec_from_file_location("check_edge_cache", SCRIPT)
    if spec is None or spec.loader is None:
        msg = f"cannot load {SCRIPT}"
        raise ImportError(msg)
    module = importlib.util.module_from_spec(spec)
    sys.modules["check_edge_cache"] = module
    spec.loader.exec_module(module)
    return module


ec = load()

HOME_HTML = b'<html><head><link href="/_next/static/chunks/abc123.css"></head></html>'
STATIC = "/_next/static/chunks/abc123.css"
HTML_CC = "private, no-cache, no-store, max-age=0, must-revalidate"

type Reply = Any

Responder = Callable[[str, Mapping[str, str], int], Reply]


class FakeSite:
    """A transport that answers by path and counts requests per URL."""

    def __init__(self, responder: Responder) -> None:
        """Wrap a responder (path, request headers, nth request) -> Reply."""
        self.responder = responder
        self.calls: list[tuple[str, dict[str, str]]] = []

    def __call__(self, url: str, headers: Mapping[str, str], want_body: bool) -> Reply:  # noqa: FBT001  # Transport signature
        """Answer one request."""
        path = urlsplit(url).path
        nth = sum(1 for p, h in self.calls if p == path and "Cookie" not in h)
        self.calls.append((path, dict(headers)))
        reply = self.responder(path, headers, nth)
        return reply if want_body else ec.Reply(reply.status, reply.headers)


def reply(cf: str | None, cache_control: str = "", **extra: str) -> Reply:
    """Build a reply with the given cf-cache-status."""
    headers = {"cache-control": cache_control, **extra}
    if cf is not None:
        headers["cf-cache-status"] = cf
    return ec.Reply(200, headers, HOME_HTML)


def good_site(path: str, headers: Mapping[str, str], nth: int) -> Reply:
    """Answer as the site should once the cache rules exist."""
    cached = path in {
        "/robots.txt",
        "/sitemap.xml",
        STATIC,
        "/api/stations/index",
        "/api/transit/networks",
    }
    cached = cached or path.startswith("/Line/")
    if cached:
        if "Cookie" in headers:
            return reply("BYPASS", "private, no-store")
        return reply("MISS" if nth == 0 else "HIT", "public, max-age=300", age="12")
    if path == "/sw.js":
        return reply("DYNAMIC", "no-cache")
    return reply("DYNAMIC", HTML_CC)


def run(site: FakeSite, *args: str) -> tuple[int, str, list[float]]:
    """Run main against the fake site with no real sleeping."""
    sleeps: list[float] = []
    out = io.StringIO()
    with redirect_stdout(out):
        code = ec.main(["--delay", "0.2", *args], transport=site, sleep=sleeps.append)
    return code, out.getvalue(), sleeps


class CheckEdgeCacheTest(unittest.TestCase):
    """The checker against fake sites."""

    def test_all_pass_once_rules_exist(self) -> None:
        """A correctly configured edge passes everywhere and exits 0."""
        site = FakeSite(good_site)
        code, out, _ = run(site)
        self.assertEqual(code, 0, out)
        self.assertNotIn("WARN", out)
        self.assertNotIn("FAIL", out)

    def test_polite_request_count_and_user_agent(self) -> None:
        """Tens of requests, all with the tool's User-Agent, all GET-able."""
        site = FakeSite(good_site)
        _, _, sleeps = run(site)
        self.assertLess(len(site.calls), 40)
        self.assertEqual(len(sleeps), len(site.calls) - 1)
        for _, headers in site.calls:
            self.assertIn("distant-signal-check-edge-cache", headers["User-Agent"])

    def test_before_rules_warns_but_exits_zero(self) -> None:
        """Today's behaviour (robots EXPIRED, JSON DYNAMIC) is WARN, not FAIL."""

        def today(path: str, headers: Mapping[str, str], nth: int) -> Reply:
            if path == STATIC:
                return reply(
                    "MISS" if nth == 0 else "HIT", "public, max-age=31536000, immutable"
                )
            if path == "/robots.txt":
                return reply("EXPIRED", "public, max-age=14400")
            return (
                good_site(path, headers, nth)
                if path == "/sw.js"
                else reply("DYNAMIC", "public, max-age=3600")
            )

        code, out, _ = run(FakeSite(today), "--json")
        self.assertEqual(code, 0)
        doc = json.loads(out)
        verdicts = {r["class"]: r["verdict"] for r in doc["results"]}
        self.assertEqual(verdicts["robots.txt"], "WARN")
        self.assertEqual(verdicts["api stations index"], "WARN")
        self.assertEqual(verdicts["next static asset"], "PASS")
        self.assertEqual(verdicts["home html"], "PASS")
        code, _, _ = run(FakeSite(today), "--strict")
        self.assertEqual(code, 1)

    def test_cookie_request_hit_is_critical(self) -> None:
        """A cookie-bearing request served as HIT fails with exit 1."""

        def leaky(path: str, headers: Mapping[str, str], nth: int) -> Reply:
            if path == "/api/stations/index" and "Cookie" in headers:
                return reply("HIT", "public, max-age=300")
            return good_site(path, headers, nth)

        code, out, _ = run(FakeSite(leaky), "--json")
        self.assertEqual(code, 1)
        verdicts = {r["class"]: r["verdict"] for r in json.loads(out)["results"]}
        self.assertEqual(verdicts["api stations index"], "FAIL")
        self.assertEqual(verdicts["api transit networks"], "PASS")

    def test_cookie_sent_on_cookie_checks_only(self) -> None:
        """The session cookie goes only on the negative checks."""
        site = FakeSite(good_site)
        run(site)
        with_cookie = [(p, h) for p, h in site.calls if "Cookie" in h]
        self.assertTrue(with_cookie)
        for path, headers in with_cookie:
            self.assertEqual(headers["Cookie"], "distant_signal_session=x")
            self.assertIn(
                path,
                {
                    "/",
                    "/api/stations/index",
                    "/api/transit/networks",
                    "/Line/Mode/tube/Status",
                },
            )

    def test_line_route_cookie_hit_is_only_a_warning(self) -> None:
        """The cookie-free TfL-shaped route may be cached for any caller."""

        def line_hits(path: str, headers: Mapping[str, str], nth: int) -> Reply:
            if path.startswith("/Line/"):
                return reply("HIT", "public, s-maxage=30")
            return good_site(path, headers, nth)

        code, out, _ = run(FakeSite(line_hits), "--json")
        self.assertEqual(code, 0)
        verdicts = {r["class"]: r["verdict"] for r in json.loads(out)["results"]}
        self.assertEqual(verdicts["public line status"], "WARN")

    def test_html_hit_is_warn_and_private_hit_is_fail(self) -> None:
        """Cached HTML is unexpected; HIT despite private/no-store is critical."""

        def html_cached(path: str, headers: Mapping[str, str], nth: int) -> Reply:
            if path == "/lines/c2c":
                return reply("HIT", "public, s-maxage=60")
            if path == "/stations/EUS":
                return reply("HIT", HTML_CC)
            return good_site(path, headers, nth)

        code, out, _ = run(FakeSite(html_cached), "--json")
        verdicts = {r["class"]: r["verdict"] for r in json.loads(out)["results"]}
        self.assertEqual(verdicts["line page"], "WARN")
        self.assertEqual(verdicts["station page"], "FAIL")
        self.assertEqual(code, 1)

    def test_set_cookie_hit_is_critical(self) -> None:
        """A cached response that sets a cookie fails."""

        def setter(path: str, headers: Mapping[str, str], nth: int) -> Reply:
            if path == "/robots.txt":
                return reply("HIT", "public, max-age=300", **{"set-cookie": "a=b"})
            return good_site(path, headers, nth)

        code, _, _ = run(FakeSite(setter))
        self.assertEqual(code, 1)

    def test_service_worker_cache_control(self) -> None:
        """/sw.js must not be advertised as cacheable."""

        def sw(path: str, headers: Mapping[str, str], nth: int) -> Reply:
            if path == "/sw.js":
                return reply("REVALIDATED", "max-age=14400")
            return good_site(path, headers, nth)

        _, out, _ = run(FakeSite(sw), "--json")
        verdicts = {r["class"]: r["verdict"] for r in json.loads(out)["results"]}
        self.assertEqual(verdicts["service worker"], "WARN")

    def test_missing_cf_header_warns(self) -> None:
        """No cf-cache-status (not behind Cloudflare) is a WARN."""

        def bare(*_: object) -> Reply:
            return reply(None, "no-store")

        code, out, _ = run(FakeSite(bare), "--json")
        self.assertEqual(code, 0)
        self.assertTrue(
            any(
                "no cf-cache-status" in n
                for r in json.loads(out)["results"]
                for n in r["notes"]
            )
        )

    def test_nothing_answers_exits_two(self) -> None:
        """If every request errors, exit 2."""

        def down(*_: object) -> Reply:
            msg = "connection refused"
            raise ec.TransportError(msg)

        out = io.StringIO()
        with redirect_stdout(out):
            code = ec.main(["--delay", "0.2", "--only", "robots.txt"], transport=down)
        self.assertEqual(code, 2)

    def test_static_asset_is_found_in_home_page(self) -> None:
        """The asset URL comes from the home page's markup."""
        self.assertEqual(ec.find_static_asset(HOME_HTML), STATIC)
        self.assertIsNone(ec.find_static_asset(b"<html></html>"))

    def test_table_columns_and_json_shape(self) -> None:
        """The table shows both requests' cf-cache-status; JSON lists requests."""
        _, table, _ = run(FakeSite(good_site))
        self.assertIn("cf-cache-status", table)
        self.assertIn("MISS / HIT", table)
        _, js, _ = run(FakeSite(good_site), "--json")
        doc = json.loads(js)
        robots = next(r for r in doc["results"] if r["class"] == "robots.txt")
        self.assertEqual([q["label"] for q in robots["requests"]], ["1st", "2nd"])
        self.assertEqual(robots["requests"][1]["age"], "12")

    def test_bad_arguments(self) -> None:
        """A tiny delay or a non-http base URL is refused."""
        site = FakeSite(good_site)
        self.assertEqual(run(site, "--base-url", "ftp://x")[0], 2)
        out = io.StringIO()
        with redirect_stdout(out):
            self.assertEqual(ec.main(["--delay", "0"], transport=site), 2)
        self.assertEqual(site.calls, [])


if __name__ == "__main__":
    unittest.main()
