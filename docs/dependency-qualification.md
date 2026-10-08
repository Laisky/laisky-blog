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
