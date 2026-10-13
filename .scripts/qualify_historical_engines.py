"""Characterize exact blog bundles in offline historical engines without changing browser policy."""
import argparse
import asyncio
import datetime
import hashlib
import importlib.util
import json
from pathlib import Path
from urllib.parse import urlsplit

from playwright.async_api import async_playwright

FEATURES = {
    'nullish': 'globalThis.__engineProbe = [null ?? "fallback", 0 ?? 9, false ?? true, "" ?? "other"];',
    'top-level-await': 'globalThis.__engineProbe = await Promise.resolve(7);',
    'object-has-own': 'globalThis.__engineProbe = typeof Object.hasOwn;',
    'truncated-negative-control': 'function deliberatelyTruncated() {',
    'regexp-negative-control': 'const deliberatelyBroken = /unterminated;',
}
ROUTES = ['/pages/0/', '/p/article-0/', '/golubgrowth', '/flexcds']
OBSERVER = '''globalThis.__engineFaultObserved = false;
addEventListener('error', function () { globalThis.__engineFaultObserved = true; });
addEventListener('unhandledrejection', function () { globalThis.__engineFaultObserved = true; });'''


def digest(path):
    """digest returns the SHA-256 of bytes at the supplied path without executing them."""
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def read_fixture():
    """read_fixture takes no arguments and returns the existing intercepted GraphQL fixture module."""
    path = Path(__file__).with_name('qualify_blog_browser.py')
    spec = importlib.util.spec_from_file_location('blog_browser_fixture', path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def exception_summary(payload):
    """exception_summary returns only safe fixture error identity and one-based generated coordinates."""
    detail = payload['exceptionDetails']
    error = detail.get('exception', {})
    return {
        'type': error.get('className', 'Error'),
        'message': error.get('description', detail['text']).split('\n')[0],
        'asset': urlsplit(detail.get('url', '')).path,
        'line': detail['lineNumber'] + 1,
        'column': detail['columnNumber'] + 1,
    }


async def observe(context, page):
    """observe returns a list populated with uncaught fixture exceptions for the supplied page."""
    session = await context.new_cdp_session(page)
    await session.send('Runtime.enable')
    exceptions = []
    session.on('Runtime.exceptionThrown', lambda payload: exceptions.append(exception_summary(payload)))
    return exceptions


async def feature_case(browser, name, code, major):
    """feature_case runs the supplied module unchanged and returns its expected compatibility outcome."""
    context = await browser.new_context()
    await context.add_init_script(OBSERVER)
    blocked = []

    async def serve(route):
        """serve fulfills only this feature's local HTML/module and aborts every other resource."""
        url = urlsplit(route.request.url)
        if url.netloc != 'blog.fixture':
            blocked.append(url.hostname)
            await route.abort()
        elif url.path == '/feature.js':
            await route.fulfill(body=code, content_type='application/javascript')
        elif url.path == '/':
            await route.fulfill(body='<script type="module" src="/feature.js"></script>', content_type='text/html')
        else:
            await route.abort()

    await context.route('**/*', serve)
    page = await context.new_page()
    errors = await observe(context, page)
    await page.goto('https://blog.fixture/')
    await page.wait_for_function("Object.prototype.hasOwnProperty.call(globalThis, '__engineProbe') || __engineFaultObserved", timeout=3000)
    result = await page.evaluate("Object.prototype.hasOwnProperty.call(globalThis, '__engineProbe') ? __engineProbe : null")
    expect_error = name.endswith('negative-control') or (name == 'top-level-await' and major == 88)
    if expect_error:
        assert len(errors) == 1 and errors[0]['type'] == 'SyntaxError', errors
        assert result is None
    else:
        expected = {'nullish': ['fallback', 0, False, ''], 'top-level-await': 7,
                    'object-has-own': 'undefined' if major < 93 else 'function'}[name]
        assert result == expected and not errors, (result, errors)
    assert not blocked, blocked
    await context.close()
    return {'case': name, 'kind': 'feature-control', 'source_sha256': hashlib.sha256(code.encode()).hexdigest(),
            'result': result, 'exceptions': errors, 'expected_error': expect_error, 'expectation_matched': True}


async def app_case(browser, fixture_module, dist, build, route, major, public_html=None):
    """app_case returns exact-bundle startup/redirect observations under the existing offline fixture."""
    fixture = fixture_module.Fixture(dist)
    context = await browser.new_context(viewport={'width': 1280, 'height': 800})
    await context.add_init_script(OBSERVER)
    loaded = []
    harness_errors = []

    async def serve(request):
        """serve records successfully fulfilled local assets and never forwards requests to the network."""
        parsed = urlsplit(request.request.url)
        try:
            if parsed.netloc == 'blog.fixture' and parsed.path.startswith('/assets/'):
                asset = (Path(dist) / parsed.path.lstrip('/')).resolve()
                if Path(dist).resolve() not in asset.parents or not asset.is_file():
                    raise AssertionError('Unexpected local asset path')
                loaded.append({'path': parsed.path, 'sha256': digest(asset)})
            if public_html and parsed.netloc == 'blog.fixture' and not parsed.path.startswith('/assets/'):
                await request.fulfill(body=Path(public_html).read_bytes(), content_type='text/html')
            else:
                await fixture.route(request)
        except Exception as error:
            harness_errors.append(type(error).__name__)
            await request.abort()

    await context.route('**/*', serve)
    page = await context.new_page()
    errors = await observe(context, page)
    await page.goto(fixture.origin + route)
    await page.wait_for_function("__engineFaultObserved || !!document.querySelector('#pages .post-title, #post .post-title, .section-card h1')", timeout=4000)
    rendered = await page.evaluate("!!document.querySelector('#pages .post-title, #post .post-title, .section-card h1')")
    expected_error = 'SyntaxError' if major == 88 else 'TypeError' if major in (89, 91) else None
    redirected = False
    if expected_error:
        assert not rendered and len(errors) == 1 and errors[0]['type'] == expected_error, (rendered, errors)
        expected_text = 'Unexpected reserved word' if major == 88 else 'Object.hasOwn is not a function'
        assert expected_text in errors[0]['message'], errors
        assert fixture.metrics()['operations'] == 0
    else:
        assert rendered and not errors, (rendered, errors)
        if route in ('/golubgrowth', '/flexcds'):
            assert await page.get_by_role('heading', name='404 - Page Not Found').count() == 1
            await page.wait_for_url('**/pages/0/', timeout=6000)
            await page.get_by_role('heading', name='Article 8', exact=True).wait_for(timeout=3000)
            redirected = True
        elif route.startswith('/p/'):
            await page.get_by_role('heading', name='Readable body 0', exact=True).wait_for(timeout=3000)
        else:
            await page.get_by_role('heading', name='Article 8', exact=True).wait_for(timeout=3000)
    await page.wait_for_timeout(150)
    if expected_error is None:
        assert not errors, errors
    assert not harness_errors, harness_errors
    assert any(row['path'].startswith('/assets/index-') and row['path'].endswith('.js') for row in loaded)
    await context.close()
    return {'case': build + ':' + route, 'kind': 'exact-application', 'build': build, 'route': route,
            'rendered': rendered, 'redirected_to_list': redirected, 'exceptions': errors,
            'expected_error_type': expected_error, 'loaded_assets': loaded,
            'fixture_operations': fixture.metrics()['operations'], 'expectation_matched': True}


async def main():
    """main parses CLI paths, runs one actual engine, and saves each completed case before continuing."""
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--browser', required=True, type=Path)
    parser.add_argument('--baseline', required=True, type=Path)
    parser.add_argument('--candidate', required=True, type=Path)
    parser.add_argument('--major', required=True, type=int, choices=[88, 89, 91, 107, 143])
    parser.add_argument('--public-html', type=Path)
    parser.add_argument('--report', required=True, type=Path)
    args = parser.parse_args()
    report = {'captured_at_utc': datetime.datetime.now(datetime.timezone.utc).isoformat(),
              'requested_major': args.major, 'browser_binary_sha256': digest(args.browser),
              'user_agent_override': False, 'network_intercepted': True, 'production_changed': False,
              'fixtures_sha256': digest(Path(__file__).with_name('qualify_blog_browser.py')),
              'harness_sha256': digest(__file__), 'results': [], 'complete': False}

    def save():
        """save takes no arguments, persists the current partial report, and returns no value."""
        args.report.parent.mkdir(parents=True, exist_ok=True)
        args.report.write_text(json.dumps(report, indent=2) + '\n')

    try:
        async with async_playwright() as playwright:
            browser = await playwright.chromium.launch(executable_path=str(args.browser), args=[
                '--no-sandbox', '--disable-dev-shm-usage', '--host-resolver-rules=MAP * ~NOTFOUND'])
            report['engine'] = browser.version
            assert int(browser.version.split('.')[0]) == args.major
            for name, code in FEATURES.items():
                report['results'].append(await feature_case(browser, name, code, args.major))
                save()
            module = read_fixture()
            for build, directory in [('baseline', args.baseline), ('deployed', args.candidate)]:
                for route in ROUTES:
                    report['results'].append(await app_case(browser, module, directory, build, route, args.major))
                    save()
            if args.public_html:
                report['results'].append(await app_case(browser, module, args.candidate, 'public-html-replay', '/pages/0/', args.major, args.public_html))
                save()
            await browser.close()
            report['complete'] = True
    except Exception as error:
        report['harness_failure'] = type(error).__name__ + ': ' + str(error)
        raise
    finally:
        save()
        print(json.dumps({'engine': report.get('engine'), 'completed_cases': len(report['results']), 'complete': report['complete']}))


if __name__ == '__main__':
    asyncio.run(main())
