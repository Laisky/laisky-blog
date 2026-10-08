# Fast CI policy (2026-10-08)

The maintainer requests minimal automatic pre-merge checks. `Fast CI / test`
adds changed-file formatting and nine existing deterministic unit tests on
pull requests and pushes to `v2`. This CI scheduling policy supersedes general
lint/test/build requirements for CI-only scheduling changes. Application changes
still require full local dev/staging qualification before promotion.

The existing `ci.yml` publishing and deployment workflow is separate and
unchanged. This change does not alter production builds, health checks,
credentials, secrets, security scanning or branch protection. The new test job
has read-only permissions and does not retain checkout credentials.

## Formatting scope and existing debt

Prettier checks supported files changed since the verified PR base SHA or push
before SHA, plus this workflow, policy and runner/control files. Renamed files
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
