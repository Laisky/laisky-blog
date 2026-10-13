# Blog handoff qualification — 2026-10-13

## Delivery

PR #200 implements the confirmed mechanisms in #196, #197 and #198. It is not a production deployment receipt. #199 remains an investigation, and the issuer-gated SSO migration in PR #195 is untouched.

Baseline: `d6f59f62fc91ccc86e41b32aad0aa4169e7ece2b`, tree `f2043b2a1259d8087445c3929a3135d84713a662`. Implementation commits: `f77c283` (#196), `8fc14cd` (#197), and `6421e09` (#198). Their tree, `98f5d1bb20583962f0b1820a63e22bc1310bad68`, exactly matches the qualified local source. Subsequent CI and evidence changes do not alter application code.

No dependency version, lockfile, API schema, database, authentication policy, Sentry credential or browser target changed.

## Reproduction and regression results

SHA initialization originally produced 14 hardened failures against 14 passing ordinary controls. Repairing that exposed a second real built-app startup failure in Mermaid's Day.js dependency. Both initializers now define only package-owned properties, retain immutable inherited protections, and reject unqualified source-digest drift. Hash outputs, streaming/HMAC/binary/Unicode inputs, public wrapper promises, cache keys, date arithmetic and UTC behavior are covered. The failing original SHA initializer remains an executable negative control.

List-loading tests originally produced 14 failures and 5 passing controls. Recovery tests originally produced 6 failures, 2 passes and 7 unhandled errors. A later focused test reproduced a duplicate current-article request from initial language notification. These are now passing regressions; test-harness and temporary tooling-workflow errors were corrected separately, not counted as product defects.

With Node 22.16.0, Yarn Classic 1.22.22 and the original frozen dependencies, full lint, all **19 unit files / 167 tests**, and the production build pass. No tests are skipped. Existing bundle-size and test-environment warnings remain visible. The permanent CI change runs the full unit suite and explicitly requires all **82 handoff regressions** across seven files; missing/duplicate files or cases, skips and native failures fail closed. Existing fast-CI discovery and essential-nine controls remain intact. Local checks also passed 19 Node CI controls and 12 Python deployment-helper controls; these are not live deployment tests.

```sh
yarn install --frozen-lockfile --non-interactive
yarn lint
yarn test --run --allowOnly=false --passWithNoTests=false
yarn build
```

## Built-browser acceptance

The optional `.scripts/qualify_blog_browser.py` harness uses Python `playwright==1.57.0` and its matching Chromium. The actual engine was **143.0.7499.4**. Every request is intercepted before app startup: exact production assets come from disk, GraphQL responses are fixtures, and third-party resources/telemetry never reach live hosts. MathJax is stubbed; bundled Mermaid Gantt rendering is real. No production login, Sentry event or live performance measurement was made.

All **36 cases** match their expected outcomes. Baseline hardened startup is an expected failure, not an application pass. The receipts retain engine, artifact hashes, outcomes and measurements:

- [Startup: 8 cases](evidence/blog-20261013/browser-startup.json): actual ordinary/hardened HTTP/HTTPS realms, with the inherited protection retained.
- [Lists: 14 cases](evidence/blog-20261013/browser-lists.json): paired cold/warm/forced loads, empty lists, first/last/beyond-last and invalid routes.
- [Failures: 9 cases](evidence/blog-20261013/browser-failures.json): network abort, HTTP 503, malformed JSON, GraphQL error, empty result, independent scripts/retry, partial series recovery and hardened Gantt rendering.
- [Lifecycle: 5 cases](evidence/blog-20261013/browser-lifecycle.json): timeout/retry, obsolete article success/rejection, obsolete series completion, keyboard page edges and back/forward navigation.

```sh
python .scripts/qualify_blog_browser.py \
  --baseline /path/to/baseline/dist \
  --candidate /path/to/candidate/dist \
  --browser /path/to/matching/chrome-headless-shell \
  --section startup \
  --report /path/to/receipt.json
```

Repeat for `lists`, `failures` and `lifecycle`. Candidate contexts have no unhandled page errors. The lifecycle report's held-request counters are control-flow observations, not precise transport-attempt counts: a held request can be recorded at start and settlement. Use the paired list report for request-budget comparisons.

In the identical nine-article list fixture, cold requests fall from **17 to 4** and JSON response-body bytes from **90,066 to 6,995**. Forced loads fall from **21 to 4** operations and **110,803 to 6,995** bytes. Warm loads remain **2 operations / 58 bytes**. Counts include sidebar requests. These are fixture body bytes, not compressed transfer or production benchmarks. Eager detail calls fall from nine to zero. Out-of-range page 3 for 21 posts makes only the count request; negative/non-numeric routes make no requests. This is frontend over-fetching, not a SQL N+1 claim.

## Behavior and safety bounds

#196 uses exact-source guarded, idempotent repairs for js-sha256 0.11.1 and Day.js 1.11.23 before dev/test/coverage/build. It never weakens global prototypes, preserves hash/cache contracts, and invalidates relevant Vite optimizer output only after a change. Hooks do not assume application scripts exist during the Docker dependency-install layer.

#197 consumes router data once, validates bounds before list requests, removes neighboring-page and detail speculation, preserves existing cache keys, and separates language/force in-flight reads. An older ordinary response cannot overwrite a newer forced cache write. Pagination allocates at most seven entries, and stale view/listener results are ignored.

#198 independently owns optional scripts, exposes static safe diagnostics and user-initiated retries, and uses 15-second consumer deadlines. Cancellation abandons the consumer and observes late settlements; it does not claim to abort every underlying transport or downloaded script. Series rendering is text-safe, detached until a current-route commit, and bounded by cycle/depth (8), branches (64), children (64), and total posts (2,000). Successful siblings survive failures. Historical bodies still require server reauthorization, never old archive cache trust. Authored article HTML and existing security tests remain intact.

## #199: evidence gained, investigation still open

The rebuilt baseline exactly matches `index-C4Ql5MCr.js`, SHA-256 `e70691b88f42ad59e1e4e5fb15e4c854943f1cd435f93d5c7fb20c3b129e0d50`. The candidate is `index-DaARSYtk.js`, SHA-256 `85b85245b99cf6c788f1203d3ee8c4431c9a60be608b0e1479715a46aa9cc14f`.

That establishes reproducible current/baseline artifact identity, not attribution of every older event. G5 (missing regular-expression slash) and G6 (unexpected EOF) still need exact event artifacts and useful positions. FR and 94 (nullish-coalescing token errors, reported Chrome 91/89) remain separate unconfirmed groups. FY (reserved word, reported Chrome 88) has a top-level-await compatibility hypothesis, not a verified cause.

The existing async Sentry CDN loader is unchanged. No public source maps, new filters, browser-target changes, source-map uploads or private settings changes were added. Chromium 143 is not Chrome 88/89/91; no user-agent spoof is treated as an engine test. Private event access, release/environment association, matching private source maps and any synthetic verification event remain subject to #199's approval boundary. Match each event to immutable served bytes and its actual engine before choosing a repair or policy change.

## Release and rollback

Review the exact final PR head and green CI before merging. The existing `v2` pipeline affects production. Retain the last deployed immutable image/artifact digest and use the existing scoped deployment/rollback checks. After rollout, verify list/current/history routes, real request budgets and fresh monitoring. Optional service reachability and the original hardening initiator still require deployment observation.

Revert the corresponding implementation commit and dependent regression accounting, or revert the complete merge; rebuild from a clean frozen install and redeploy the last qualified artifact. No database rollback or cache-schema migration is needed. Reverting #196 restores its known hardened-startup failure; do not compensate by weakening global protections. Do not combine this release with the gated SSO cutover or mark #199 resolved without its missing evidence.
