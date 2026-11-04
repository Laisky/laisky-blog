# Frontend dependency qualification (2026-10-08)

PR189 is qualified against the maintained Vite/React frontend on v2, including
the release192 safeguards. The deprecated Python application is outside this
dependency update.

## Reproduced install regression

Yarn Classic 1.22.22 with supported Node 22.23.3 fails a clean frozen install of
PR189 during dependency linking: it cannot find a copy of Vite in Vitest's
nested node_modules. The same error appears in Fast CI run 37824151604 before
formatting or application tests execute. Node 22.7.0 separately fails the
existing package engine requirement and is not a valid qualification runtime.

Vitest 4.1.0 permits Vite 6, 7, or 8, and the proposed lockfile resolves its
dependency to Vite 8.3.4 while the application uses Vite 7.3.7. A Yarn selective
resolution pins Vite to the qualified 7.3.7 version for both consumers. This
retains the supported Vite 7 application toolchain and avoids an incidental
major build-tool migration. Revisit the resolution when intentionally upgrading
Vite; verify clean frozen installation, test discovery, application tests, and
the production build together.

References: [Vitest 4.1.0 manifest](https://github.com/vitest-dev/vitest/blob/v4.1.0/packages/vitest/package.json),
[Yarn selective resolutions](https://classic.yarnpkg.com/lang/en/docs/selective-version-resolutions/).

The unintended package-lock.json delta is reverted to the current v2 file.
Yarn alone regenerates yarn.lock. No application rendering, authentication,
publishing policy, deployment routes, or CI scheduling is changed.

## Regression and qualification checks

The existing Fast CI runner supplies a durable frozen-install regression gate
and verifies exact discovery and successful completion of nine essential tests.
It failed on the original proposal and must pass on the repaired candidate.
The new dependency compatibility suite uses real DOMPurify and Mermaid packages
to check supported menu links and diagrams. Existing article compatibility
tests retain authored HTML/Slide embeds, live/historical routes, cache behavior,
and historical authorization lifecycle checks.

Local qualification uses a supported Node 22 runtime and Yarn Classic 1.22.22:

- Fresh frozen installation in a separate temporary directory.
- Fast CI controls and runner with the current v2 base SHA.
- Full ESLint, Vitest (one worker), and Vite production build.
- Existing bounded Chromium article/diagram compatibility harness.
- Release helper unit tests to confirm retained exact-image and rollback behavior.

Heavy checks stay local. The automatic CI remains formatting and fast units;
production publishing and deployment remain owned by the existing workflow.

## Supplemental transitive updates (PR193)

The next proposal retains useful Yarn-only updates: Rollup 4.64.3, Flatted 3.4.4,
Minimatch 3.1.5 and 9.0.9, and Picomatch 2.3.2. The unrelated npm-lock delta is
reverted. The Vite 7.3.7 resolution and all application/deployment behavior remain
intact.

Rollup's optional LZMA package is explained by its official manifest and upstream
cross-toolchain fix; its runtime loader imports the platform Rollup binary.
Reviewed tarballs match registry SHA512/SHA1 values and registry ECDSA signatures.
No changed package has preinstall/install/postinstall hooks. Downloaded provenance
names the official Rollup and LZMA source commits; full Sigstore transparency and
certificate validation was not performed. Qualification uses Node 22.23.3, which
also satisfies the optional LZMA package's Node 22.20 requirement.

Flatted's malformed circular-reference payload exposes Array.prototype with the
previous 3.3.3 dependency and is rejected by 3.4.4. The reproduction checks identity
without writing to a global prototype. Durable tests cover that rejection and
valid cyclic round trips. The existing application tests, real diagrams, authored
embeds, frozen installs, lint, build, and release-helper checks pass locally with
bounded resources.

Primary sources:
[Rollup release](https://github.com/rollup/rollup/releases/tag/v4.64.3),
[Rollup LZMA explanation](https://github.com/rollup/rollup/pull/6467),
[Flatted prototype advisory](https://github.com/WebReflection/flatted/security/advisories/GHSA-rf6f-7fwh-wjgh),
[Minimatch nested-extglob advisory](https://github.com/isaacs/minimatch/security/advisories/GHSA-23c5-xmqv-rm74),
[Minimatch globstar advisory](https://github.com/isaacs/minimatch/security/advisories/GHSA-7r86-cg39-jmmj),
[Picomatch release](https://github.com/micromatch/picomatch/releases/tag/2.3.2).

## Full upgrade on top of PR201 (2026-11-04)

PR201 (Dependabot: DOMPurify 3.4.17, PostCSS, Rollup, nanoid) is extended into
a full upgrade. Every package is refreshed within its declared range, and the
majors listed below are applied. The npm lockfile delta is again reverted to
the v2 file.

### Majors applied and the compatibility fixes they needed

- **Vite 8.3 + @vitejs/plugin-react 6.2.** Vite 8 always follows
  `resolve.mainFields` (browser before module); the heuristic that used to
  pick ESM when `browser` pointed at a UMD file is gone. `@laisky/js-utils`
  has no `exports` map and its `browser` field points at a UMD bundle. Without
  a fix, `KvGet`/`KvSet`/... are missing from the default import. The build
  passes and pages still render, because the storage fallbacks absorb the
  errors, but client caching stops working: the Chromium list-cache
  qualification fails. `resolveAliases` in `vite.config.js` pins the package's
  ESM build, and `bundledHashWrapper.test.js` reuses it and checks every
  default member the app calls. The Vite 7.3.7 `resolutions` pin is removed,
  because Vitest 5 takes Vite as a peer. The new default build target is
  Safari 16.4, Chrome/Edge 111 and Firefox 114. Builds drop from about a
  minute to about 4 seconds.
- **Mermaid 12.3.** The new defaults are: ELK layout, the `redux-color` theme
  with the `neo` look for most diagram types, and flowchart/state nodes at
  least 120px wide with labels wrapping at 120px. `src/jsx/library/diagrams.js`
  sets the Mermaid 11 layout, theme, look and node sizing once, before the
  first render. In Chrome, flowchart, sequence, gantt, state and class
  diagrams render at the same sizes as on v2. Article front matter and
  `%%{init}%%` directives still override these settings. An article that asks
  for `layout: elk` now actually gets ELK (Mermaid 11 silently fell back to
  dagre), and ELK throws in a realm where `Object.prototype.toString` is
  read-only. A scan of the built bundle for post-Safari-16 APIs
  (`Object.groupBy`, `Promise.withResolvers`, `toSorted`, `findLast` and
  similar) finds only `Object.groupBy`, and only in the new cynefin and
  usecase diagram types. Mermaid 12 pulls
  KaTeX 0.18.11, which is deprecated because its strict-mode metric warnings
  shipped as a breaking minor; it only affects math inside diagrams.
- **lucide-react 1.67.** Brand icons were removed. The About page's GitHub and
  Twitter icons are now built with `createLucideIcon` from the 0.554 path data
  (`components/brandIcons.js`), so the markup and the `.lucide` classes are
  unchanged. Lucide also redrew `BookOpen` slightly.
- **ESLint 10 + @eslint/js 10.** ESLint 9 reached end of life on 2026-08-06.
  The config only used `eslint-plugin-react` to switch off a rule that was
  never enabled, and its component-detection rules crash on ESLint 10, so the
  plugin is removed. `eslint-plugin-import` and `eslint-plugin-jsx-a11y` were
  never configured and stop at ESLint 9, so they are removed as well.
  `eslint-plugin-react-hooks` 7 keeps enforcing `rules-of-hooks`.
- **No code change needed:** html-react-parser 6, Vitest 5, jsdom 30 (Node
  ^22.22.2), jest-dom 7 (replacing the deprecated 6.10.0), globals 17,
  eslint-plugin-react-refresh 0.5, and TypeScript 6.0.3 (exact pin,
  typescript-eslint supports <6.1).

### Held back

- graphql 17: graphql-request 7.4 allows only graphql 14-16.
- marked 16+: `@laisky/js-utils` 0.0.5 requires marked ^15.0.7.
- js-sha256 1.0: the app hashes through `@laisky/js-utils`, which keeps 0.11.
  1.0 still assigns `toString` and would invalidate the SHA-pinned repair.
- TypeScript 7: typescript-eslint refuses it.

### Qualification

The following were run with Node 22.22.3 and Yarn 1.22.22 on a fresh clone
with an empty Yarn cache:

- A frozen install with no peer or engine warnings.
- The Fast CI controls and runner against the v2 base.
- Full Vitest with regression accounting, ESLint and the production build.

The Dockerfile builder stage installs and builds on `node:22-bullseye`
(Node 22.23.2).

In Chrome 157 (Playwright 1.64.1), the `lists`, `failures` and `lifecycle`
sections of `.scripts/qualify_blog_browser.py` pass. The list, article and
About pages are pixel-identical to v2 in light and dark mode at desktop and
mobile widths, except for the animated wave emoji and Lucide's `BookOpen`.
The Vite 8 dev server serves cached lists, diagrams and the About icons
without page errors.

### Pre-existing gap found during qualification

In a realm where `Object.prototype.toString` is read-only, gantt diagrams
render Mermaid's error SVG on v2 and on this branch alike. The cause is d3-format's
`FormatSpecifier.prototype.toString = ...` assignment, not dayjs. The
harness's `diagram` fault only waits for `.mermaid svg`, so it accepts that
error SVG as a pass. This upgrade leaves the behaviour unchanged.

Primary sources:
[Vite 8 migration](https://vite.dev/guide/migration),
[Mermaid changelog](https://github.com/mermaid-js/mermaid/blob/develop/packages/mermaid/CHANGELOG.md),
[Lucide 1.0](https://lucide.dev/guide/version-1),
[ESLint version support](https://eslint.org/version-support/),
[ESLint 10 migration](https://eslint.org/docs/latest/use/migrate-to-10.0.0),
[Vitest migration](https://vitest.dev/guide/migration),
[KaTeX releases](https://github.com/KaTeX/KaTeX/releases).
