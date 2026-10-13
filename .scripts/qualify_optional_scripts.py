"""Qualify optional script ordering and retry cleanup using exact builds and intercepted resources only."""
import argparse
import asyncio
import hashlib
import importlib.metadata
import json
from pathlib import Path
from urllib.parse import urlparse

from playwright.async_api import async_playwright
from qualify_blog_browser import Fixture, context_for


class SlowScriptsFixture(Fixture):
    """SlowScriptsFixture holds one optional request and fulfills all others with executable local markers."""

    def __init__(self, dist, held_feature):
        """__init__ records a fixed held feature and per-feature request starts."""
        super().__init__(dist)
        self.held_feature = held_feature
        self.script_requests = {"analytics": 0, "search": 0}

    async def route(self, route):
        """route holds only the first chosen optional request and marks executed local resources."""
        host = urlparse(route.request.url).netloc
        feature = {"www.googletagmanager.com": "analytics", "cse.google.com": "search"}.get(host)
        if not feature:
            return await super().route(route)
        self.script_requests[feature] += 1
        if feature == self.held_feature and self.script_requests[feature] == 1:
            self.started.set()
            await self.hold.wait()
        return await route.fulfill(
            body="window.optionalExecuted=window.optionalExecuted||{};window.optionalExecuted[" + json.dumps(feature) + "]=true;",
            content_type="application/javascript",
        )


async def scripts(browser, args):
    """scripts pairs real execution-order controls and checks owned retries across a stalled resource."""
    rows = []
    for label, dist in [("baseline", args.baseline), ("candidate", args.candidate)]:
        for held_feature in ("analytics", "search"):
            fixture = SlowScriptsFixture(dist, held_feature)
            context, page = await context_for(browser, fixture)
            await page.goto(fixture.origin + "/p/article-0/", wait_until="domcontentloaded")
            await asyncio.wait_for(fixture.started.wait(), timeout=5)
            await page.get_by_role("heading", name="Readable body 0", exact=True).wait_for(timeout=5000)
            other = "search" if held_feature == "analytics" else "analytics"
            await page.wait_for_timeout(500)
            executed = await page.evaluate("feature => window.optionalExecuted?.[feature] === true", other)
            expected = label == "candidate" or held_feature == "search"
            assert executed == expected, (label, held_feature, executed)
            fixture.hold.set()
            await page.wait_for_function("window.optionalExecuted?.analytics && window.optionalExecuted?.search")
            assert not fixture.errors, fixture.errors
            rows.append({"build": label, "held_feature": held_feature, "other_executed_before_release": executed,
                         "both_executed_after_release": True, "expected_outcome_matched": True})
            await context.close()
        fixture = SlowScriptsFixture(dist, "search")
        context, page = await context_for(browser, fixture)
        await page.clock.install()
        await page.goto(fixture.origin + "/p/article-0/", wait_until="domcontentloaded")
        await asyncio.wait_for(fixture.started.wait(), timeout=5)
        await page.get_by_role("heading", name="Readable body 0", exact=True).wait_for(timeout=5000)
        await page.clock.fast_forward(16000)
        retry = page.get_by_role("button", name="Retry search")
        await retry.wait_for(timeout=5000)
        await retry.click()
        await page.wait_for_timeout(500)
        executed = await page.evaluate("window.optionalExecuted?.search === true")
        # Chromium can share an in-flight identical script URL. A consumer deadline does not
        # promise a new transport; retry must recover when that resource resumes, without
        # retaining obsolete DOM consumers or adding provider-specific cache-busting parameters.
        retained = await page.locator('script[src*="cse.google.com"]').count()
        assert retained == (1 if label == "candidate" else 2), (label, retained)
        fixture.hold.set()
        await page.wait_for_function("window.optionalExecuted?.search === true")
        assert not fixture.errors, fixture.errors
        if label == "candidate":
            await page.wait_for_function("Array.from(document.scripts).filter(s=>s.src.includes('cse.google.com')).every(s=>s.onload===null && s.onerror===null)")
        rows.append({"build": label, "scenario": "search-timeout-retry", "retry_executed_before_release": executed,
                     "retained_consumers_before_release": retained, "recovered_after_release": True,
                     "script_requests": fixture.script_requests, "expected_outcome_matched": True})
        await context.close()
    return rows


async def main():
    """main compares the pre-fix PR and candidate with the same real engine, retaining exact artifact identities."""
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--baseline", required=True, type=Path)
    parser.add_argument("--candidate", required=True, type=Path)
    parser.add_argument("--browser", required=True)
    parser.add_argument("--report", required=True, type=Path)
    args = parser.parse_args()
    report = {"section": "scripts", "live_traffic_allowed": False,
              "playwright": importlib.metadata.version("playwright"), "assets": {}}
    for name, directory in [("baseline", args.baseline), ("candidate", args.candidate)]:
        report["assets"][name] = {f.name: hashlib.sha256(f.read_bytes()).hexdigest()
                                  for f in sorted((directory / "assets").glob("index-*.js"))}
    try:
        async with async_playwright() as playwright:
            browser = await playwright.chromium.launch(executable_path=args.browser, args=["--no-sandbox"])
            report["engine"] = browser.version
            report["results"] = await scripts(browser, args)
            report["passed"] = True
            await browser.close()
    except Exception as error:
        report["passed"] = False
        report["failure"] = str(error)
        raise
    finally:
        args.report.parent.mkdir(parents=True, exist_ok=True)
        args.report.write_text(json.dumps(report, indent=2) + "\n")
        print(json.dumps(report, indent=2))


if __name__ == "__main__":
    asyncio.run(main())
