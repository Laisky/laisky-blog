# Fast CI policy (2026-10-08)

The maintainer requests minimal automatic pre-merge checks. GitHub
`Fast CI / test` retains the current `v2` baseline: changed-file formatting and
nine existing deterministic unit tests on pull requests and pushes to `v2`.
Manual GitHub dispatch remains available with a verified full comparison SHA.
CircleCI provides the same fast gate only through an explicit opt-in pipeline
parameter; it is disabled by default. This CI scheduling policy supersedes
general lint/test/build requirements for CI-only scheduling changes. Application
changes still require full local dev/staging qualification before promotion.

The existing `ci.yml` publishing and deployment workflow is separate and
unchanged. This change does not alter production builds, health checks,
credentials, secrets, security scanning or branch protection. The GitHub test
job has read-only permissions and does not retain checkout credentials.

## Formatting scope and existing debt

Prettier checks supported files changed since the verified PR base SHA, push
before SHA or explicit manual-dispatch SHA in GitHub. An opted-in CircleCI run
uses the candidate merge base or `v2` first parent described below. Both include
the workflow, policy and runner/control files. Renamed files
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
tests execute anew. A five-minute timeout bounds the automatic GitHub job and the opted-in CircleCI gate.

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
fast checks and release controls remain unchanged. The CircleCI workflow is
disabled unless a caller explicitly sets the boolean `run-fast-ci` to `true`.

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
setting is modified. Local parsing and control tests do not establish hosted
config compilation or execution; any opted-in hosted acceptance must be checked
at the exact candidate head.

## Explicit CircleCI opt-in (2026-10-11)

The current `v2` GitHub fast workflow keeps its `pull_request`, `push` and manual
dispatch subscriptions byte-for-byte. The additional CircleCI workflow declares
a top-level boolean `run-fast-ci` with default `false` and uses it in its
workflow-level `when` condition. A normal pipeline omitting the parameter
schedules no CircleCI job. To request the bounded fast gate explicitly, trigger
a branch pipeline from the CircleCI web app or API with:

```json
{
  "parameters": {
    "run-fast-ci": true
  }
}
```

The opt-in changes scheduling only. Existing anonymous exact-commit checkout,
image pin, small executor, frozen setup, formatting, nine units, failure
controls, base resolution and artifact receipts remain intact. Tags remain
ignored. External subscriptions may still create CircleCI pipeline records;
this configuration does not claim to prevent pipeline creation or change
external trigger/account settings.

When external CircleCI subscriptions would have created a pipeline, the
unconditional inherited adapter plus restored GitHub subscriptions would
schedule two quality jobs for a pull request to `v2`, five quality/release jobs
for a `v2` push (two quality plus three release), and one job for another branch.
With the default-false CircleCI condition these counts become one, four and
zero respectively, preserving the current `v2` automatic baseline. An explicit
CircleCI opt-in schedules one additional fast job for a branch pipeline.
Counts exclude unchanged managed CodeQL analyses, Snyk and CodeRabbit and do not
claim savings in unobserved provider queue or execution time.

CircleCI documents this exact boolean-default-false and workflow-level `when`
pattern in [Pipeline parameters and conditional workflows](https://circleci.com/docs/guides/orchestrate/pipeline-variables/#pipeline-parameters-and-conditional-workflows).

Full lint, the complete unit suite, build, coverage and security/browser
regressions remain local or explicitly manual. The `yarn coverage` command,
test files and assertions are unchanged; no vulnerability, coverage or other
result is converted to success or discarded.
