# Fast CI policy (2026-10-08)

The maintainer requests minimal automatic pre-merge checks. CircleCI is the
single automatic provider for changed-file formatting and nine existing
deterministic unit tests. The GitHub `Fast CI / test` job remains available
through explicit manual dispatch with a verified full comparison SHA; it no
longer repeats the automatic CircleCI gate on pull requests or pushes. This CI
scheduling policy supersedes general lint/test/build requirements for CI-only
scheduling changes. Application changes still require full local dev/staging
qualification before promotion.

The existing `ci.yml` publishing and deployment workflow is separate and
unchanged. This change does not alter production builds, health checks,
credentials, secrets, security scanning or branch protection. The retained manual GitHub test job
has read-only permissions and does not retain checkout credentials.

## Formatting scope and existing debt

Prettier checks supported files changed since the verified candidate merge base
or `v2` first parent in CircleCI, or the explicitly provided full base SHA in
manual GitHub dispatch, plus this workflow, policy and runner/control files. Renamed files
are checked at their new paths; deletions have no content to check. The existing
Prettier configuration and ignore file remain authoritative (including the
existing SCSS exclusion). Missing, malformed, unknown or all-zero base SHAs fail
closed. A manual dispatch requires an explicit full base SHA.

Six untouched files currently fail the locked Prettier baseline:

- `src/jsx/__tests__/components/modal.test.jsx`
- `src/jsx/__tests__/library/graphqlRequest.test.jsx`
- `src/jsx/__tests__/pages/manage.test.jsx`
- `src/jsx/pages/pages.jsx`
- `src/jsx/pages/post.jsx`
- `index.html`

Changed-file formatting does not certify the entire repository is formatted.
Any future change touching these files must resolve its formatting failure.
The baseline failures are preserved as known debt, not converted into success
or fixed in overlapping application/deployment work.

## Essential unit gate and receipts

Node 22 and Yarn Classic 1.22.22 perform a frozen lockfile install using the
authoritative `yarn.lock`. The gate runs all four `postMeta.test.jsx` tests and
all five `pagesFold.test.js` tests, using the existing Vitest configuration,
jsdom environment and React Testing Library setup. No assertions or test files
are changed, and no coverage, build, browser or performance campaign runs here.

Vitest discovery must return the exact nine names and two files. Native exit
codes, total/passed counts, assertion status and successful file completion must
all agree; missing, duplicate, renamed, skipped, pending or failed tests fail
the gate. Focused-only tests and empty suites cannot pass. Eleven controls verify
these failure paths, including native exit 7 and a real timed-out process.
An additional real formatter probe must reject deliberately unformatted input
with exit 1, so a dropped `--check` option cannot turn formatting into success.
Raw command outputs, discovery, JSON reports and measured setup/gate wall times
are retained on success and failure. Dependency/build caching is allowed;
tests execute anew. A five-minute timeout bounds the automatic job.

```sh
corepack enable
corepack prepare yarn@1.22.22 --activate
node --test .scripts/test_fast_ci.mjs
BASE_SHA=$(git rev-parse --verify 'origin/v2^{commit}')
FAST_CI_BASE="$BASE_SHA" FAST_CI_EVIDENCE=/tmp/blog-fast-ci node .scripts/fast_ci.mjs
```

Fetch `origin/v2` before using this local example and verify that it is the
intended comparison base for the full candidate change. If another base is
needed, resolve that commit instead. `FAST_CI_BASE` must contain a valid full,
nonzero commit SHA available in the checkout; it is not a branch name or shell
placeholder.

## Retained local dev/staging qualification

Use the repository's Node 22 toolchain and Yarn for broader changes:

```sh
yarn install --frozen-lockfile --non-interactive
yarn lint
yarn test --run
yarn build
yarn coverage
yarn prettier --check src index.html vite.config.js eslint.config.js package.json
make dev
```

Run browser, integration, accessibility, performance and environment checks
against local dev/staging when the change affects those behaviors. These manual
commands preserve the full suite and expose existing failures; this policy does
not waive them. Publishing/deployment remains owned by the existing workflow.

## CircleCI fast-gate adapter (2026-10-09)

CircleCI was connected to this repository but no configuration exists in its
full recorded history. It rejected PR #195 at configuration discovery, before
any application test ran. `.circleci/config.yml` now executes the same frozen
formatting and nine-unit gate on one small executor; it does not build, publish,
run browser campaigns, or deploy. The Node 22.22.3 executor image is pinned by
manifest digest, and Yarn Classic must report 1.22.22. Existing GitHub Actions
release remains unchanged, while its duplicate fast gate is manual only.

The adapter fetches `v2` and compares a candidate branch with its merge base,
including a branch's first pipeline when CircleCI has no previous build SHA.
When the checkout equals the fetched `v2` tip, it compares with the first parent
(the complete merged PR delta for a merge or squash commit). This parent rule
does not claim push-event coverage for multiple directly pushed commits; use
manual GitHub dispatch with the complete pre-push comparison SHA for that. Missing or unrelated history
fails closed. Five local Git-fixture controls cover these cases without remote
requests. The existing eleven runner controls and release-helper controls run
before the real gate. The gate command is bounded to five minutes and retains
its native output, discovery, assertions and timing receipts as artifacts.

No external integration, branch-protection rule, secret, context or account
setting is modified. The detailed protection endpoint is inaccessible to the
available integration (403), but the readable `v2` branch summary reports
protection disabled and required-status enforcement off with empty checks;
repository rulesets are empty. No observed protection requires the duplicate
GitHub fast job. CircleCI hosted acceptance is checked at the exact candidate
head rather than assuming a valid configuration implies successful tests.

## Automatic duplication removed (2026-10-09)

The authorized simplification removes only the GitHub fast workflow's
`pull_request` and `push` subscriptions. Its job, failure controls, explicit
manual-dispatch base input, artifact receipts, and all underlying test coverage
remain intact. CircleCI continues the genuine automatic frozen setup,
formatting and nine-unit gate. Its all-branch/tag-ignore filters and external
trigger settings are unchanged; no extra job or account setting is introduced.
The three-job GitHub release workflow and its `v2` push trigger remain
byte-for-byte identical.

When both providers would have triggered, a pull request's repository-defined
quality jobs decrease from two to one, and a `v2` push's quality plus release
jobs decrease from five to four. Other branch pipelines remain one CircleCI
job. These conditional counts exclude unchanged managed CodeQL analyses,
Snyk and CodeRabbit. Actual CircleCI push/PR subscriptions are external and
have not been modified. The removed GitHub duplicate's measured job time and
the retained fast-gate receipt are recorded in PR #195; no reduction is claimed
for unobserved CircleCI queue or execution time.

Full lint, the complete unit suite, build, coverage and security/browser
regressions remain local or explicitly manual. The `yarn coverage` command,
test files and assertions are unchanged; no vulnerability, coverage or other
result is converted to success or discarded.
