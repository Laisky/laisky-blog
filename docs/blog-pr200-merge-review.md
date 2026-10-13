# PR #200 final merge review — 2026-10-13

## Scope and reproduction

The delegated pre-merge review started at `34fabca2d9c3aa1259be5c602f955760b024b56b` (tree `d65b98bac76351853d4eb3b9bcd5661bcad58e92`). The reconstructed tree and rebuilt `index-DaARSYtk.js` exactly matched the preceding qualification. Existing review feedback was already resolved; lint, 167 units, the build and existing failure controls were rerun successfully before further changes.

A new #198 acceptance gap reproduced in real Chromium: holding only analytics prevented the already-returned search script from executing. The locked utility sets `async=false` on inserted scripts, putting independent features in the same ordered execution queue. Releasing analytics made both scripts execute. This was a reproduced dependency between optional features, not evidence of the initiating production outage.

Seven focused DOM lifecycle controls were added: six failed and one passed on the pre-fix owner. The unit baseline mirrors the locked utility's DOM behavior because that package's Node entry cannot run directly under Vitest; the separate built-browser controls exercise the real bundled implementation. This harness import limitation was not counted as a product failure.

## Repair

`loadOptionalScript` now creates an explicitly asynchronous script for each fixed allowlisted feature, keeps bounded consumer deadlines, detaches load/error handlers on settlement and removes unsuccessful consumers. Success leaves the loaded element intact. Error identities remain static and do not retain DOM targets, private URLs or response bodies. The script URLs, application dependencies, locks, authentication and source-map settings are unchanged.

The existing App recovery tests now exercise the real optional-script owner with intercepted DOM events rather than mocking the utility's request promise. The seven added controls are required by the existing CI accounting, increasing retained handoff regressions from 82 to 89.

## Final qualification

Node 22.16.0, Yarn Classic 1.22.22 and the original locked dependencies:

- Full lint and production build pass.
- All 20 unit files / 174 tests pass, with zero skipped tests; all 89 required regressions are accounted for.
- All 22 native Node CI controls and 12 deployment-helper unit controls pass.
- All 36 original built-browser cases were rerun against the new asset and matched their expected outcomes.
- Six additional paired script controls pass against the pre-fix PR and candidate. Search executes while analytics remains held; analytics executes while search is held. Timed-out attempts release their DOM consumers, and retry recovers when the transport resumes.

Candidate entry: `index-Bkwg43V1.js`, SHA-256 `14a7a0c0e583c8ffab3633d37f67c4bb698e93aeee9bd151ec030fc4d355ba56`. Engine: Chromium 143.0.7499.4. Every browser resource was intercepted; no production login, GraphQL request or telemetry event was sent during these local tests. Original nine-article request budgets remain four cold/forced operations with zero eager detail loads.

[Retained final qualification receipt](evidence/blog-20261013/merge-review.json). Historical receipts remain unchanged and identify their older assets.

```sh
python .scripts/qualify_optional_scripts.py \
  --baseline /path/to/pr-34fabca/dist \
  --candidate /path/to/candidate/dist \
  --browser /path/to/chrome-headless-shell \
  --report /path/to/script-receipt.json
```

## Negative control refinement and limits

An initial test required a same-URL retry to execute while its first resource remained held. Chromium shared that in-flight resource, including after removing the old script element, so the stronger transport assumption failed on the candidate. That expectation was not treated as an execution-order defect: the corrected control retains the observation, checks consumer cleanup and confirms recovery after transport resumes. No provider-specific cache-busting parameters were introduced. Removing a script cannot undo already-executed code, and a consumer timeout is not a guarantee that its underlying download is aborted.

The authoritative HTML processing model distinguishes the ordered dynamic-script queue from asynchronous execution: <https://html.spec.whatwg.org/multipage/scripting.html#the-script-element>.

## Merge and release boundary

The user authorized resolving remaining PR problems and merging when qualified. Merge only the reviewed head after current CI passes. The existing `v2` pipeline is the production release path; its scoped helper retains the previous immutable image and verifies rollback if rollout fails. No production result is claimed by this pre-merge receipt. Verify the actual workflow outcome separately.

Rollback remains an isolated revert of the final script change or a revert of the complete PR as appropriate, followed by a clean build and the existing scoped deployment procedure. Keep #199 open: historical syntax-event mapping, private source maps and actual old-engine evidence remain unconfirmed. PR #195 and its ordered SSO migration are not included.

## CircleCI integration reconciliation

The complete commit-status review (not just Actions checks) identified a pre-existing CircleCI integration error: no configuration file was present in `v2` or this PR. The GitHub Fast CI quality gate was passing; the CircleCI failure happened before any quality job existed.

This PR now reuses only the independent CI checkout/base-selection files from PR #195 at `ed553ef3797c1399687d2b25937f5622d3ad2ee3`. No SSO source or runtime migration is included. CircleCI is an explicit optional second provider, gated by the existing `run-fast-ci` boolean defaulting to false. GitHub Fast CI remains automatic and unchanged in its application acceptance. When explicitly enabled, CircleCI runs the frozen setup, changed-file formatting, essential units, the complete unit suite and required-regression accounting. It performs no deployment and introduces no browser downloads or heavy builds.

Five native base-selection controls and four exact-checkout controls were rerun locally; they pass. These controls now also run in GitHub Fast CI. Source matching verifies the three reused helper/test files are byte-identical to their reviewed PR #195 versions. Local YAML parsing and shell syntax checks validate both the opt-in condition and executable steps. This is not a claim that the opt-in executor ran on CircleCI; the actual hosted configuration/status result must be checked after the commit. No remote service settings, credentials, branch protections or status overrides are changed.

The added CI controls bring the totals to 28 native Node controls and 16 Python checkout/deployment controls. Application code and the 174-unit / 42-browser qualification remain unchanged.

CircleCI documents workflow conditions and typed pipeline parameters in its [configuration reference](https://circleci.com/docs/reference/configuration-reference/#using-when-in-workflows) and [pipeline parameter guide](https://circleci.com/docs/guides/orchestrate/pipeline-variables/).

## Retained-identity review correction

Review comment 4258342634 identified a real accounting gap: replacing one retained test with an unrelated passing test in the same file preserved the count and uniqueness checks. The new negative control reproduced this false acceptance before the repair (eight controls passed; the new rejection control failed). The checker now compares exact ancestor/title identities against a reviewed, checked-in manifest of all 89 retained regressions, rather than generating its expectations from the current CI report. A removed/replaced test, duplicate identity, missing file, native failure or skipped test fails closed. Review comment 4258342622 is also addressed by clarifying both function comments' inputs and return behavior. The updated native controls pass; the unchanged complete 174-unit report passes the stricter identity checker.
