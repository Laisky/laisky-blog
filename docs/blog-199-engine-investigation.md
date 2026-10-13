# Issue #199: resumed state and real-engine evidence

## Checkpoint

PR #200 remains merged as `c8f8fc3d19c7ac1bc880b18ba6edcad14729ff47`, tree `1f831e300849230cf34c4677ed339d88f83117cb`. Its release workflow `38395086067` completed successfully, including deployment. No new production release or application repair was performed in this investigation. The SSO migration in PR #195 remains separate.

The restored source index matches that merged tree exactly. Its rebuilt entry matches both the deployment receipt and a fresh public capture at **2026-10-13 13:40:07 UTC**: `/assets/index-Bkwg43V1.js`, SHA-256 `14a7a0c0e583c8ffab3633d37f67c4bb698e93aeee9bd151ec030fc4d355ba56`. `/pages/0/`, `/golubgrowth`, and the entry script returned HTTP 200 in the completed capture. This verifies public serving and entry identity, not every live API or client session.

The first script-capture attempt returned HTTP 403 after the HTML succeeded. A single bounded retry applied consistent release-verification headers to all requests and succeeded. This is not evidence of a general outage or its cause; no access-control configuration was changed.

## Findings

The final harness completed **67 expected outcomes**, including deliberately failing negative controls. These are not 67 successful application startups.

| Actual engine         | Cases | Both original and deployed app bundles                                       |
| --------------------- | ----: | ---------------------------------------------------------------------------- |
| Chromium 88.0.4298.0  |    13 | Fails parsing at top-level `await`: `Unexpected reserved word`.              |
| Chromium 89.0.4389.0  |    13 | Parses, then fails in Mermaid: `Object.hasOwn is not a function`.            |
| Chromium 91.0.4469.0  |    13 | Same distinct runtime failure as Chromium 89.                                |
| Chromium 107.0.5296.0 |    14 | List, current article, and both unknown-route redirects succeed.             |
| Chromium 143.0.7499.4 |    14 | Same successful application controls, including captured public HTML replay. |

All five engines execute the `??` control correctly. The feature controls also distinguish top-level-await module execution from DevTools evaluation and detect intentionally truncated JavaScript and an intentionally invalid regular expression. Each application run uses the unchanged original or deployed bundle for `/pages/0/`, `/p/article-0/`, `/golubgrowth`, and `/flexcds`. The 107/143 runs additionally replay captured public HTML with intercepted resources.

These are actual Linux Chromium snapshots, with reported engine versions and binary hashes, not user-agent overrides and not the exact Android stable patch builds reported by historical events. Every browser request is intercepted; no production login, API request, or telemetry event is sent by the browser tests. Optional external scripts are stubbed. The fresh public byte capture was a separate unauthenticated HTTP operation.

The local Chrome 107 attempt was blocked by an existing administration policy before any case executed. That zero-case failure is retained separately and excluded from the 67 outcomes. The same verified browser binary then completed in isolated GitHub Actions run `38409329299`; no local policy was disabled or modified.

## Exact source mapping

A local hidden-source-map build emitted JavaScript byte-identical to the freshly captured public entry. Mapping uses the exact map associated with those bytes; mapped source content hashes also match the installed source. No map was uploaded, committed, deployed, or verified through Sentry.

| Reproduced failure           | Generated position, one-based | Mapped source, one-based                                                                   |
| ---------------------------- | ----------------------------- | ------------------------------------------------------------------------------------------ |
| Chromium 88 syntax error     | `index-Bkwg43V1.js:739:8739`  | `src/jsx/main.jsx:17:1`, the existing SSO callback `await`.                                |
| Chromium 89/91 runtime error | `index-Bkwg43V1.js:380:27101` | `node_modules/mermaid/dist/chunks/mermaid.core/chunk-I66GZJ75.mjs:38:21`, `Object.hasOwn`. |

The same mechanisms occur in the original `index-C4Ql5MCr.js` baseline, so these observations do not establish a regression introduced by PR #200. The matched baseline entry remains SHA-256 `e70691b88f42ad59e1e4e5fb15e4c854943f1cd435f93d5c7fb20c3b129e0d50`.

## Scope and policy

Resolving the actual installed Vite **7.3.7** configuration returns `chrome107`, `edge107`, `firefox104`, and `safari16`, with source maps disabled. The historical 88/89/91 engines fall below this compiler target. This records existing build behavior; it does not declare a new product-support policy. No target, polyfill, global prototype, SSO ordering, or dependency version was changed to make an unexplained alert disappear.

The configured Chrome 107 target and the established Chromium 143 reference pass these targeted controls. Firefox, Safari, and exact historical Android patches were not newly tested here. Passing this matrix is not comprehensive certification of every feature or platform.

Fresh local lint and all **174 unit tests** pass with zero skips, and the exact **89 retained regression identities** pass their existing accounting check. The ordinary build and the separate hidden-map build both succeed and retain the deployed entry bytes. Earlier PR #200 release controls are prior evidence, not claimed as new runs.

## Individual historical-event dispositions

- **FY:** A real Chromium 88 top-level-await incompatibility is now reproduced and source-mapped. Attribution of the original FY event is still unconfirmed because its failing source position and exact artifact are missing.
- **FR:** The reported `??` syntax exception is not reproduced. Chromium 91 accepts that syntax and fails later on a different runtime API. Do not substitute the new TypeError as FR's root cause.
- **BLOG-94:** Also not reproduced as the reported `?` parse error. Chromium 89's new TypeError is a separate mechanism; the historical event lacks a position.
- **G5:** Remains unconfirmed. The harness detects an intentionally invalid regexp, but clean unknown-route controls do not identify the original failing bytes.
- **G6:** Remains unconfirmed. The harness detects intentionally truncated JavaScript; clean unknown routes render and redirect in target/reference engines. The original event still lacks the needed artifact and position.

## Durable evidence and next boundary

The reusable script is `.scripts/qualify_historical_engines.py`; it reuses `.scripts/qualify_blog_browser.py`. `docs/evidence/blog-20261013/historical-engine-summary.json` is explicitly a derived summary and includes the SHA-256 identities of the full native JSON receipts, public capture, compiler settings, and source mappings. The complete native reports are retained in the conversation evidence bundle; the Chrome 107 native artifact is also attached to Actions run `38409329299`. Temporary provisioning workflows are removed from the final investigation branch. Its history preserves the exact input-acquisition commands.

```sh
python3 .scripts/qualify_historical_engines.py \
  --browser /path/to/verified/chromium \
  --major 107 \
  --baseline /path/to/original/dist \
  --candidate /path/to/deployed/dist \
  --report /path/to/chromium107.json
```

Use Python Playwright 1.57.0 in an isolated environment. Optional `--public-html` replays a separately captured shell; it does not enable live network access. Do not run obsolete browsers against real user accounts or untrusted live content. The harness records each completed case before proceeding and fails on unexpected outcomes, allowing a failed engine to be rerun alone.

**Issue #199 stays open.** Exact historical event artifacts/positions and private Sentry release/map linkage are still missing. No Sentry connector was returned by the available integration search; no private events or post-release counts were inspected. Issues #196–#198 have shipped fixes, but their requested matched-window production observation is not completed by this investigation. Seven days after release verification is **2026-10-20 12:10:57 UTC / 08:10:57 America/Toronto**. No automatic monitoring task was created.

## Primary references

- Vite 7 build target and hidden-source-map behavior: https://v7.vite.dev/config/build-options
- V8 top-level-await semantics and module-versus-REPL distinction: https://v8.dev/features/top-level-await
- Puppeteer historical engine version mappings: https://pptr.dev/supported-browsers
- Snapshot revisions are pinned in official Puppeteer `src/revisions.ts` at tags `v5.5.0` (818858), `v6.0.0` (843427), `v9.0.0` (869685), and `v18.1.0` (1045629).
