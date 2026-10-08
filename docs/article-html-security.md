# Historical article publication boundary

This frontend change accompanies the backend archive-provenance repair for [issue 187](https://github.com/Laisky/laisky-blog/issues/187). The historical loader always asks `BlogPostHistory` for an authorized body and never returns legacy `postHistory` cached bodies. A previous cached foreign archive or a newly protected publication therefore cannot bypass the server check. Live article caching and authored article rendering remain unchanged.

The earlier broad sanitizer proposal is superseded. Source-authored iframes, Slide HTML, style, media, SVG/MathML, and the existing menu, Mermaid, series and image behavior are preserved. A deliberately authored iframe can execute HTML; that conditional browser behavior alone does not establish an unintended attacker publishing path. The confirmed defect was acceptance of an arbitrary unregistered gateway archive by the public history API and subsequent cache reuse.

Backend repair requires trusted current publication metadata before any gateway fetch. Unknown/unrelated/never-published IDs, hidden/password-protected posts, explicit nonpublish status, and database lookup failures are denied. Registered public archive bodies retain their exact authored content, including legacy/gzip/translations and registered legacy missing-status compatibility.

The ten unit regressions verify server rejection and fresh authorization with cache hit/miss, preserve live caching, clear previous history bodies/menus during fresh authorization, ignore obsolete route results, show safe denial text, and exercise the actual renderer with source-authored HTML and Slide markup. The local Chrome fixture exercises live/history and cached/network controls with the actual `Post` renderer, real Mermaid, and local mocked server decisions. All requests outside its exact loopback origin are aborted and service workers are blocked; it performs no production or blockchain actions.

```sh
PLAYWRIGHT_MODULE=/absolute/path/to/playwright/index.mjs \
CHROME_PATH=/usr/bin/google-chrome \
node scripts/security/post-html-browser.mjs
```

The fixed browser matrix retains the authored iframe execution marker and formatting/media/code/diagram/series/image-modal controls, while rejected historical bodies cannot render or execute even when a foreign body exists in the legacy cache. The `--reproduce` flag is for a checkout with the original historical loader: it requires the cached foreign marker to execute without any server authorization call. Browser fixtures mock server decisions; retained backend Mongo-wire/HTTP-transport regressions separately establish the actual authorization boundary before outbound fetch.

Each history view now requires server availability and a fresh archive lookup/fetch. Heavy browser verification remains local; CI stays limited to formatting and fast units.
