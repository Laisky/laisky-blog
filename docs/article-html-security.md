# Article HTML security boundary

Current posts, historical posts, and both cache paths converge on `sanitizeArticleHtml` before `html-react-parser` converts the HTML to React elements. The menu uses the same formatting policy. Source records and caches remain unchanged; each render sanitizes them.

The allowlist preserves headings and anchors, text formatting, lists, tables, details, figures, images, code blocks, and series metadata. It excludes scripts, frames, embedded objects, forms, styles, templates, resource tags, custom elements, and source SVG/MathML. URL attributes allow HTTP(S) and relative resources; links also allow `mailto:` and `tel:`. Inline data and other resource protocols are excluded. External HTTP(S) content origins remain supported. Heading IDs and the legacy series `key` attribute survive so existing navigation and series replacements continue working.

Code replacement creates React text nodes. Series metadata is escaped before interpolation, and post names are URL encoded before the generated HTML is sanitized; trusted Lucide icons remain available. Mermaid uses its strict security level, preventing source diagram directives from enabling HTML or click handlers. Trusted MathJax rendering continues after source HTML sanitization.

## Regression checks

Run the fast route and policy tests with `yarn test --run src/jsx/__tests__/pages/postHtml.test.jsx --maxWorkers=1`. They use mocked GraphQL, caches, identity, and comments. The checks cover the four live/history and GraphQL/cache combinations plus safe formatting and generated series content.

The retained browser harness imports the actual `Post` component into a local fixture. It replaces remote services with deterministic mocks, stubs MathJax, renders real Mermaid diagrams, blocks every request outside its loopback origin, and uses DOM markers as execution canaries. It never signs in, sends account requests, or opens production pages.

Run `node scripts/security/post-html-browser.mjs` with an installed Playwright module available. When Playwright is provided outside this checkout, set `PLAYWRIGHT_MODULE` to its `index.mjs` path; optionally set `CHROME_PATH` to a local Chromium executable. No browser dependency is added to normal CI. The harness starts and stops its own Vite server on loopback port 11307, checks non-execution and active-node removal in all four cases, and verifies code, diagrams, series, lazy images, and the image modal. The `--reproduce` mode requires the vulnerable iframe marker and is intended only for a vulnerable baseline checkout.

Before the fix, all four browser cases executed the local iframe `srcdoc` canary. The async external-script marker was absent in that baseline, so it is retained as a rejection test without claiming baseline execution. After the fix, neither marker executes and no canary node is rendered.

Required repository acceptance checks remain `yarn lint`, `yarn test --run`, and `yarn build`. Run the full unit suite with one worker when sharing a busy development host. Production response headers were not measured and CSP is not changed by this repair.

## Primary references

- [DOMPurify configuration and post-sanitization guidance](https://github.com/cure53/DOMPurify)
- [React script resource handling](https://react.dev/reference/react-dom/components/script)
- [Mermaid strict security and protected configuration keys](https://mermaid.js.org/config/schema-docs/config.html#securitylevel)
