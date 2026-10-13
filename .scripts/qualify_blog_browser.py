"""Qualify built blog artifacts with intercepted local fixtures; never send live traffic."""
import argparse
import asyncio
import hashlib
import importlib.metadata
import json
import mimetypes
from pathlib import Path
from urllib.parse import parse_qs, urlparse

from playwright.async_api import async_playwright


class Fixture:
    """Fixture owns one browser context, its fault controls, and public fixture metrics."""

    def __init__(self, dist, total=9, fault=None, scheme="https"):
        self.dist = Path(dist).resolve()
        self.total = total
        self.fault = fault
        self.origin = scheme + "://blog.fixture"
        self.records = []
        self.errors = []
        self.warnings = []
        self.series = False
        self.hold = asyncio.Event()
        self.started = asyncio.Event()

    def post(self, index, detail=False):
        """post returns a deterministic public article fixture with distinct list/detail sizes."""
        value = {"name": f"article-{index}", "title": f"Article {index}", "created_at": "2026-01-01",
                 "modified_at": "2026-01-01", "type": "post", "menu": "", "tags": [], "category": [], "arweave_id": []}
        if detail:
            value["content"] = f"<h2>Readable body {index}</h2>" + "<p>Public fixture content.</p>" * 300
            if self.series or (self.fault == "series-stale" and index == 0):
                value["content"] += '<div class="post_series" key="root"></div>'
            if self.fault == "diagram":
                value["content"] += '<pre class="mermaid">gantt\n dateFormat YYYY-MM-DD\n section Build\n Task :a1, 2026-10-13, 1d</pre>'
        else:
            value["markdown"] = "Public excerpt. " * 37
        return value

    async def route(self, route):
        """route intercepts every resource and fulfills fixtures or explicitly aborts them."""
        url = urlparse(route.request.url)
        if url.netloc == "blog.fixture":
            resource = (self.dist / url.path.lstrip("/")).resolve()
            if self.dist not in resource.parents:
                return await route.abort()
            if not resource.is_file():
                if url.path.startswith("/assets/"):
                    return await route.fulfill(status=404, body="missing local asset")
                resource = self.dist / "index.html"
            return await route.fulfill(body=resource.read_bytes(), content_type=mimetypes.guess_type(str(resource))[0] or "application/octet-stream")
        if url.netloc == "gq_v2.laisky.com":
            return await self.graphql(route, parse_qs(url.query))
        if url.netloc == "www.googletagmanager.com" and self.fault == "analytics":
            return await route.abort("blockedbyclient")
        if url.netloc == "cse.google.com" and self.fault == "search":
            return await route.abort("blockedbyclient")
        if "MathJax.js" in url.path:
            return await route.fulfill(body="window.MathJax={Hub:{Queue:function(item){if(typeof item==='function')item();}}};", content_type="application/javascript")
        # Third-party scripts, fonts, and telemetry never reach their real hosts.
        return await route.fulfill(body="", content_type="text/css" if url.netloc == "fonts.googleapis.com" else "application/javascript")

    async def graphql(self, route, params):
        """graphql serves only the known public query shapes and records actual response-body bytes."""
        import re
        query = params.get("query", [""])[0]
        variables = json.loads(params.get("variables", ["{}"]) [0])
        data, kind, page = None, "unknown", None
        if "BlogPostInfo" in query:
            kind, data = "count", {"BlogPostInfo": {"total": self.total}}
        elif "BlogPostCategories" in query:
            kind, data = "categories", {"BlogPostCategories": []}
        elif "BlogTags" in query:
            kind, data = "tags", {"BlogTags": []}
        elif "GetBlogPostSeries" in query:
            kind = "series"
            if self.fault == "series-stale":
                self.started.set()
                await self.hold.wait()
            if variables["key"] == "broken":
                self.records.append({"kind": kind, "status": 503, "body_bytes": 0})
                return await route.fulfill(status=503, body="local unavailable")
            data = {"GetBlogPostSeries": [{"remark": variables["key"], "posts": [{"name": "sibling", "title": "Working sibling"}],
                                          "children": [{"key": "broken"}, {"key": "working"}] if variables["key"] == "root" else []}]}
        elif "BlogComments" in query:
            kind, data = "comments", {"BlogComments": [], "BlogCommentCount": 0}
        elif "BlogPosts" in query:
            if "name" in variables:
                kind = "detail"
                index = int(variables["name"].split("-")[-1])
                if self.fault in ("hold", "hold-reject") and index == 0:
                    rejected = self.fault == "hold-reject"
                    self.started.set()
                    await self.hold.wait()
                    if rejected:
                        return await route.abort("failed")
                if self.fault in ("network", "timeout", "http", "json", "graphql", "empty"):
                    fault = self.fault
                    self.records.append({"kind": kind, "fault": fault, "body_bytes": 0})
                    if fault == "timeout":
                        self.started.set()
                        await self.hold.wait()
                    elif fault == "network":
                        return await route.abort("failed")
                    elif fault == "http":
                        return await route.fulfill(status=503, body="private-fixture-canary")
                    elif fault == "json":
                        return await route.fulfill(body="not json: private-fixture-canary", content_type="application/json")
                    elif fault == "graphql":
                        return await route.fulfill(json={"errors": [{"message": "private-fixture-canary"}]})
                    elif fault == "empty":
                        return await route.fulfill(json={"data": {"BlogPosts": []}})
                data = {"BlogPosts": [self.post(index, True)]}
            else:
                kind = "list"
                match = re.findall(r"page:\s*(-?\d+)", query)
                page = int(match[-1]) if match else -999
                data = {"BlogPosts": [self.post(i) for i in range(page * 10, min(self.total, page * 10 + 10))] if page >= 0 else []}
        if data is None:
            raise AssertionError("Unexpected fixture operation: " + query[:70])
        body = json.dumps({"data": data}, separators=(",", ":")).encode()
        self.records.append({"kind": kind, "page": page, "body_bytes": len(body)})
        await asyncio.sleep(0.01)
        return await route.fulfill(body=body, content_type="application/json", headers={"Access-Control-Allow-Origin": "*", "Timing-Allow-Origin": "*"})

    def metrics(self):
        """metrics returns counts and JSON response-body sizes, not compressed network-transfer estimates."""
        return {"operations": len(self.records), "detail_requests": sum(r["kind"] == "detail" for r in self.records),
                "list_pages": [r["page"] for r in self.records if r["kind"] == "list"],
                "fixture_body_bytes": sum(r["body_bytes"] for r in self.records)}


async def context_for(browser, fixture, hardened=False):
    """context_for installs all interception and realm controls before any app script runs."""
    context = await browser.new_context(viewport={"width": 1280, "height": 800})
    if hardened:
        await context.add_init_script("Object.defineProperty(Object.prototype,'toString',{writable:false,configurable:false});")
    await context.route("**/*", fixture.route)
    page = await context.new_page()
    page.on("pageerror", lambda error: fixture.errors.append(error.stack))
    page.on("console", lambda message: fixture.warnings.append(message.text) if message.type == "warning" else None)
    return context, page


async def settled(page):
    """settled allows already-queued fixture-only speculative work to become observable."""
    await page.wait_for_timeout(300)


async def startup(browser, args):
    """startup pairs baseline and candidate browser startup in ordinary and hardened real realms."""
    rows = []
    for label, dist in [("baseline", args.baseline), ("candidate", args.candidate)]:
        for scheme in ("http", "https"):
            for hardened in (False, True):
                fixture = Fixture(dist, scheme=scheme)
                context, page = await context_for(browser, fixture, hardened)
                await page.goto(fixture.origin + "/pages/0/")
                expected = not (label == "baseline" and hardened)
                if expected:
                    await page.get_by_role("heading", name="Article 8", exact=True).wait_for(timeout=5000)
                else:
                    await page.wait_for_timeout(300)
                await settled(page)
                rendered = await page.get_by_role("heading", name="Article 8", exact=True).count() == 1
                assert rendered == expected
                assert (len(fixture.errors) == 0) == expected
                protection = await page.evaluate("Object.getOwnPropertyDescriptor(Object.prototype,'toString').writable")
                assert protection == (not hardened)
                rows.append({"build": label, "scheme": scheme, "hardened": hardened, "rendered": rendered,
                             "page_errors": fixture.errors, **fixture.metrics()})
                await context.close()
    return rows


async def lists(browser, args):
    """lists measures identical cold, warm and forced fixtures and exercises pagination boundaries."""
    rows = []
    for label, dist in [("baseline", args.baseline), ("candidate", args.candidate)]:
        fixture = Fixture(dist)
        context, page = await context_for(browser, fixture)
        for state, path in [("cold", "/pages/0/"), ("warm", "/pages/0/"), ("forced", "/pages/0/?force=1")]:
            fixture.records.clear()
            await page.goto(fixture.origin + path)
            await page.get_by_role("heading", name="Article 8", exact=True).wait_for(timeout=5000)
            await settled(page)
            row = {"build": label, "state": state, **fixture.metrics()}
            if label == "candidate":
                assert row["detail_requests"] == 0 and row["operations"] <= 4
                assert row["list_pages"] == ([] if state == "warm" else [0])
            rows.append(row)
        await context.close()
    for total, index in [(0, 0), (1, 0), (10, 0), (11, 1), (21, 2), (21, 3), (21, -1), (21, "NaN")]:
        fixture = Fixture(args.candidate, total=total)
        context, page = await context_for(browser, fixture)
        await page.goto(fixture.origin + f"/pages/{index}/")
        if index in (-1, "NaN") or index == 3:
            await page.get_by_role("heading", name="This article page does not exist.").wait_for(timeout=5000)
        elif total == 0:
            await page.get_by_text("No articles have been published yet.").wait_for(timeout=5000)
        else:
            await page.get_by_role("heading", name=f"Article {index * 10}", exact=True).wait_for(timeout=5000)
        await settled(page)
        expected = [] if index in (-1, "NaN", 3) or total == 0 else [index]
        assert fixture.metrics()["list_pages"] == expected and not fixture.errors
        rows.append({"build": "candidate", "total": total, "index": index, **fixture.metrics()})
        await context.close()
    return rows


async def failures(browser, args):
    """failures checks actual built-client transport, optional-script and branch-recovery outcomes."""
    rows = []
    for fault in ("network", "http", "json", "graphql", "empty", "search", "analytics", "series", "diagram"):
        fixture = Fixture(args.candidate, fault=fault)
        fixture.series = fault == "series"
        context, page = await context_for(browser, fixture, hardened=fault == "diagram")
        await page.goto(fixture.origin + "/p/article-0/")
        if fault in ("network", "http", "json", "graphql"):
            retry = page.get_by_role("button", name="Retry loading article")
            await retry.wait_for(timeout=5000)
            assert "private-fixture-canary" not in await page.locator("body").inner_text()
            fixture.fault = None
            await retry.click()
        elif fault == "empty":
            await page.get_by_text("This article was not found.").wait_for(timeout=5000)
        elif fault == "search":
            retry = page.get_by_role("button", name="Retry search")
            await retry.wait_for(timeout=5000)
            fixture.fault = None
            await retry.click()
            await retry.wait_for(state="detached", timeout=5000)
        elif fault == "series":
            await page.get_by_text("This series is unavailable.").wait_for(timeout=5000)
            await page.get_by_role("link", name="Working sibling").last.wait_for(timeout=5000)
        elif fault == "diagram":
            await page.locator('.mermaid svg').wait_for(timeout=10000)
        if fault != "empty":
            await page.get_by_role("heading", name="Readable body 0", exact=True).wait_for(timeout=5000)
        await settled(page)
        assert not fixture.errors, fixture.errors
        assert fixture.metrics()["detail_requests"] == (2 if fault in ("network", "http", "json", "graphql") else 1)
        if fault == "analytics":
            assert fixture.warnings.count("OptionalFeatureError: analytics script load failed (load)") == 1
        rows.append({"fault": fault, "passed": True, "page_errors": fixture.errors, **fixture.metrics()})
        await context.close()
    return rows


async def lifecycle(browser, args):
    """lifecycle tests deadlines, obsolete results, keyboard edges and navigation using actual bundled owners."""
    rows = []
    for fault in ("timeout", "hold", "hold-reject", "series-stale"):
        fixture = Fixture(args.candidate, fault=fault)
        context, page = await context_for(browser, fixture)
        if fault == "timeout":
            await page.clock.install()
        await page.goto(fixture.origin + "/p/article-0/")
        await asyncio.wait_for(fixture.started.wait(), timeout=5)
        if fault == "timeout":
            await page.clock.fast_forward(16000)
            retry = page.get_by_role("button", name="Retry loading article")
            await retry.wait_for(timeout=5000)
            fixture.fault = None
            await retry.click()
            await page.get_by_role("heading", name="Readable body 0", exact=True).wait_for(timeout=5000)
            fixture.hold.set()
            await settled(page)
            assert await page.get_by_role("heading", name="Readable body 0", exact=True).count() == 1
        else:
            await page.get_by_role("link", name="Posts", exact=True).click()
            await page.get_by_role("heading", name="Article 1", exact=True).wait_for(timeout=5000)
            await page.get_by_role("link", name="Article 1", exact=True).click()
            await page.get_by_role("heading", name="Readable body 1", exact=True).wait_for(timeout=5000)
            fixture.fault = None
            fixture.hold.set()
            await settled(page)
            assert await page.get_by_role("heading", name="Readable body 0", exact=True).count() == 0
            assert await page.get_by_text("This series is unavailable.", exact=True).count() == 0
            assert await page.get_by_role("link", name="Working sibling", exact=True).count() == 0
        assert not fixture.errors, fixture.errors
        rows.append({"fault": fault, "passed": True, "page_errors": fixture.errors, **fixture.metrics()})
        await context.close()
    fixture = Fixture(args.candidate, total=21)
    context, page = await context_for(browser, fixture)
    await page.goto(fixture.origin + "/pages/0/")
    await page.get_by_role("heading", name="Article 0", exact=True).wait_for(timeout=5000)
    await page.keyboard.press("ArrowLeft")
    assert page.url.endswith("/pages/0/")
    await page.keyboard.press("ArrowRight")
    await page.get_by_role("heading", name="Article 10", exact=True).wait_for(timeout=5000)
    await page.keyboard.press("ArrowRight")
    await page.get_by_role("heading", name="Article 20", exact=True).wait_for(timeout=5000)
    await page.keyboard.press("ArrowRight")
    assert page.url.endswith("/pages/2/")
    await page.go_back()
    await page.get_by_role("heading", name="Article 10", exact=True).wait_for(timeout=5000)
    await page.go_forward()
    await page.get_by_role("heading", name="Article 20", exact=True).wait_for(timeout=5000)
    assert not fixture.errors and fixture.metrics()["detail_requests"] == 0
    assert all(0 <= index <= 2 for index in fixture.metrics()["list_pages"])
    rows.append({"fault": "keyboard-boundaries-back-forward", "passed": True, **fixture.metrics()})
    await context.close()
    return rows


async def main():
    """main runs one bounded qualification section and retains engine and artifact identities with its results."""
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--baseline", required=True, type=Path)
    parser.add_argument("--candidate", required=True, type=Path)
    parser.add_argument("--browser", required=True)
    parser.add_argument("--section", required=True, choices=["startup", "lists", "failures", "lifecycle"])
    parser.add_argument("--report", required=True, type=Path)
    args = parser.parse_args()
    report = {"section": args.section, "live_traffic_allowed": False, "playwright": importlib.metadata.version("playwright"), "assets": {}}
    for name, directory in [("baseline", args.baseline), ("candidate", args.candidate)]:
        report["assets"][name] = {f.name: hashlib.sha256(f.read_bytes()).hexdigest() for f in sorted((directory / "assets").glob("index-*.js"))}
    try:
        async with async_playwright() as playwright:
            browser = await playwright.chromium.launch(executable_path=args.browser, args=["--no-sandbox"])
            report["engine"] = browser.version
            report["results"] = await {"startup": startup, "lists": lists, "failures": failures, "lifecycle": lifecycle}[args.section](browser, args)
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
