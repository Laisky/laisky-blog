# Blog single-use SSO callback

Refs Laisky/laisky-blog#188. This is a coordinated, opt-in protocol change. The
issuer change in Laisky/laisky-blog-graphql must be reviewed, landed, and deployed
before this frontend is deployed. After the frontend cutover, a third issuer PR
must reject unmarked legacy Blog handoffs while preserving other clients. Old
bookmarked legacy Blog handoffs can still expose a bearer until that final issuer
cutover deploys; the opt-in frontend alone does not establish full closure.
The updated final cutover preserves legitimate old bookmarks using the
credential-free consumer bootstrap below, rather than restoring URL bearers. This PR performs no deployment, credential
creation, token rotation, or production log changes.

The Blog login button creates independent 32-byte cryptographic state and PKCE
verifier values. Only the SHA-256 challenge, state, and sso_flow=code travel in
the issuer's redirect_to URL. The verifier and safe internal return route remain
in the initiating tab's sessionStorage. The initiation transaction is valid for
ten minutes so the user can complete interactive sign-in; this does not extend
the issuer's separate 60-second authorization-code lifetime.

The issuer returns only sso_code and sso_state to the registered root callback.
The frontend strips all callback parameters before storage access or asynchronous
work, consumes the tab transaction once, and redeems through a fixed HTTPS
POST https://sso.laisky.com/sso/token with client blog, registered
redirect_uri=https://blog.laisky.com, state, code, and verifier. Redirects,
cookies, caching, and referrer transmission are disabled for the exchange.
The ten-second exchange deadline and 32 KiB response limit bound work. Duplicate,
missing, malformed, mixed legacy, mismatched, expired, and replayed callbacks
fail without touching an existing session. Legacy sso_token is never accepted
as a new session or sent to the issuer.

The exchanged JWT continues to use the existing user_token key and Authorization
bearer path; existing stored sessions remain compatible. The token is the whole
session: the displayed identity is decoded from it, so one KV write changes the
session and no mixed state exists. The legacy auth_user key always held the decoded
token, so it is no longer read or written, and sign-in, logout and expiry remove it.
A failed write attempts to restore the previous token, because a write that hit its
deadline can still commit; callback handling and application bootstrap wait until
that attempt settles. Waiting preserves the generic error but does not guarantee
restoration. Whichever token survives, the identity shown matches it.
JWT decoding and expiry
checks are UI sanity checks, not signature verification or server authorization.
The mutation backend still enforces authorization. This change does not migrate
sessions into cookies or change JWT scope or lifetime.

The document sets no-referrer before external resource loading. Optional
telemetry never starts while a callback marker is visible. The inline loader in
`index.html` skips any URL carrying a marker, so a callback URL reaches the SDK
only through bootstrap, after callback consumption, and it remains disabled if
any callback marker survives cleanup. Existing Nginx root response configuration
already sets Cache-Control: no-store, no-cache, must-revalidate, matching the
registered root callback. Asset caching and authored article content are unchanged.

A code can still appear in the initial HTTP request target. It is useful only
with the initiating verifier and transaction binding and is short-lived and
single-use at the issuer. Edge/origin log redaction and deployed headers still
require separate operational verification with non-secret canaries. No claim is
made here about production log retention or existing records.

Protocol and API references:

- [RFC 9700](https://www.rfc-editor.org/rfc/rfc9700.html), sections 2.1, 4.2.4 and 4.3.
- [RFC 7636](https://www.rfc-editor.org/rfc/rfc7636.html), S256 and no plain downgrade.
- [MDN getRandomValues](https://developer.mozilla.org/en-US/docs/Web/API/Crypto/getRandomValues)
  and [SubtleCrypto.digest](https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/digest).

## Local checks

Run yarn lint, yarn test --run, and yarn build with the locked dependencies.
For bounded browser regression, set PLAYWRIGHT_MODULE to an installed Playwright
ES module and CHROME_PATH to an installed Chromium binary, then run
node scripts/security/sso-code-browser.mjs. The ten fixtures use only a local
Vite module server, a verbatim fixture document, and intercepted issuer/SDK responses; they never contact the public
Blog, issuer, or mutation backend. They verify URL/referrer containment, successful
exchange, issuer replay denial, transaction expiry/mismatch, legacy rejection,
partial storage rollback, and interruption. This is a mocked issuer integration,
not proof of deployed issuer behavior.

After yarn build, node scripts/security/sso-built-browser.mjs runs thirteen offline
cases through the actual built Blog UI, including real WebCrypto initiation,
tab transaction persistence across the mock issuer navigation, callback exchange,
ordinary same-origin return, and legacy/state/expiry/interruption denial. Every
network request is intercepted; only local built files and mocked read-only
GraphQL/issuer responses are served. Known optional SDK URLs return inert local JavaScript mocks; all other third parties are blocked.

The source-browser fixture serves its HTML verbatim because Vite development HTML
injects a development client before head meta tags. Built production HTML places
the referrer-policy meta before the application entry. No request is exempted
from referrer assertions, and no fixture response header supplies that policy.
The separate built UI checks exercise the actual compiled document.

If browser history cleanup fails, bootstrap keeps the ordinary application and
all optional SDKs uninitialized while callback markers remain. A local static
error and fixed /pages/0/ link allow a clean navigation. Existing auth keys remain
untouched. This exceptional path cannot promise a clean URL when the browser
history operation itself is unavailable; it prevents same-page optional code
from observing that URL. The built UI fixture explicitly exercises this gate.

## Credential-free legacy bookmark initiation

After the issuer cutover, ordinary old SSO-to-Blog bookmarks continue through
https://blog.laisky.com/?sso_start=1&sso_return=<internal-route>.
This URL carries no token, code, verifier or supplied transaction binding.
The bootstrap requires the exact HTTPS root, one sso_start=1, one bounded internal
sso_return, an optional single sso_issuer=sso|mcp, no fragment and no other
top-level query/callback fields. Query and
fragment for a safe article route are data inside sso_return. External,
protocol-relative, backslash/control, authentication-bearing and oversized routes
are rejected. The route is read once through URLSearchParams, then validated
without recursive decoding or a second redirect interpretation.

Bootstrap cleanup runs synchronously before storage, digest work, application
mounting or optional telemetry. The consumer discards a stale initiation
transaction and creates fresh random state/verifier values on its own origin.
Only state and S256 challenge return to SSO. Absent/sso uses the fixed
https://sso.laisky.com/ login entry; mcp uses the fixed
https://mcp.laisky.com/sso/login entry, preserving an existing origin-local MCP
session. Neither hint changes the exact Blog callback or the canonical
https://sso.laisky.com/sso/token exchange endpoint. Arbitrary URLs, unknown or
duplicate issuer hints, mixed callback markers and known parameter case aliases
are rejected. Known aliases are cleaned before optional scripts; return routes
also reject these known markers in query/fragment. Ordinary application fields
remain compatible. A valid existing issuer session
finishes this new bound flow without asking for credentials again. Exchange,
callback cleanup, replay rejection and existing-session recovery remain unchanged.
Mixed bootstrap/code/token URLs fail closed, never becoming automatic initiation.

A storage, digest or navigation failure attempts to remove the new transaction and never alters
the stored session. If history cleanup fails, the existing static error gate
keeps App and optional SDKs uninitialized. A successful bootstrap does not mount
them while navigation leaves the document.

Deliver this consumer after issuer61 supports codes and before issuer62 changes
legacy handoffs. The canonical no-store root must serve this build before cutover;
obsolete cached code cannot safely accept a reusable URL bearer. This change
does not shorten existing sessions or accept previously leaked token bookmarks.

Implementation references reviewed 2026-10-11:

- https://www.rfc-editor.org/rfc/rfc7636.html#section-4.1
- https://www.rfc-editor.org/rfc/rfc9700.html#section-4.1.3
- https://developer.mozilla.org/en-US/docs/Web/API/Window/sessionStorage
  (same-tab initiation; opener-created tabs can initially copy storage, so server
  one-time redemption remains essential).

Known protocol marker case aliases in the current query or fragment are cleaned
and rejected before exchange, App or optional telemetry. A mixed valid code query
and reserved fragment cannot redeem. Ordinary nonprotocol article fragments
remain unchanged; no generic credential-name filtering is introduced.

Browser references reviewed 2026-10-11:

- https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage
  (issuer storage belongs to its origin; the fixed MCP entry preserves that origin).
- https://developer.mozilla.org/en-US/docs/Web/API/History/replaceState
  (same-origin URL cleanup updates the current history entry without loading a document).

## Fragment marker readings (2026-11-04)

A fragment is opaque to URL parsing, but two standard readers see parameters in it:
OAuth-style fragment responses read it as form data, and hash routers read it as an
RFC 3986 relative reference whose query follows the first `?`. Reading only the
whole fragment as form data treats `#/c?sso_token=x` as the single name
`/c?sso_token`. `fragmentShowsName` in `src/jsx/library/sso.jsx` therefore
reads every `#`-delimited segment both ways, which also covers nested fragments.
The return-route validator, callback and bootstrap detection, URL cleanup and the
inline telemetry gate in `index.html` all use this reading. Names inside values
stay ordinary data, matching top-level query parsing.

Cleanup removes whole form entries, the `&`-separated units that the earlier form-data
cleanup already removed. A fragment that shows no marker under either reading is left
byte-identical. Otherwise every entry whose own text shows a marker under either reading
is dropped, and the kept entries are serialized exactly as before; a fragment without
`?` or `#` therefore cleans to the same output as the form-data-only rule. Because `&`
ends a parameter in both readings, each marker and its value lie inside one entry, so
none of them survives. Checking only the re-encoded fragment is not enough: in
`#note=x?sso_token=secret&sso_code=old`, form cleanup keeps `note`, and serialization
percent-encodes the `?` that exposed `sso_token`, so the secret would stay in history
while every reading reported the fragment clean.

The query reading passes the text after the first `?` to the `URLSearchParams`
constructor, which drops one more leading `?`. `#??sso_token` is therefore treated as a
marker. The issuer's helper does the same, so both sides agree. The extra match can only
reject a route or drop an entry; it never accepts a marker.

The checks iterate over parameter names and stop at the first match. They never spread
names into call arguments: engines limit the argument count (JavaScriptCore at 65,536, V8
by stack size), and an 800 KB fragment of `x=1` entries made the earlier spread-based
reading throw `RangeError` in Chrome. The page then never mounted, and a padded bearer
stayed in the URL.

The current page fragment is also bounded. The query reaches the page in a request line
that nginx bounds, but the browser never sends the fragment, so only the browser's own
URL limit (2 MB in Chrome) applies to it. A fragment longer than `MaxFragmentLength`
(16,384 characters after `#`) is not read; it fails closed:

- callback and bootstrap detection and the inline telemetry gate treat it as carrying a
  marker, so padding cannot push a credential past the checks;
- cleanup drops the whole fragment, and also drops a cleaned fragment whose serialization
  grows past the bound, so the cleaned URL always passes the checks again;
- the visit is then handled like any rejected callback: no exchange, an inline sign-in
  error, and the application mounts on the clean URL.

The bound is eight times the 2,048-character return route, so no fragment that the blog
or the issuer writes comes near it; fragments up to the bound are read exactly as before.
The return-route validator applies the shared reading without this bound, because its
own 2,048-character route bound applies first. The bound is consumer-side, so the shared
contract and its version do not change. `index.html` repeats the constant, and
`inlineTelemetry.test.js` pins it to `MaxFragmentLength` and checks that the inline gate
and the bundle agree on every fragment of up to four pieces.
`src/jsx/__tests__/library/ssoFragmentBounds.test.jsx` keeps the 800 KB cases, the
boundary and the serialization-growth case, and `scripts/security/sso-built-browser.mjs`
runs the padded bearer in Chrome as the `large-hash` mode.

`src/jsx/__tests__/library/ssoFragmentCleanup.test.jsx` runs cleanup on every fragment of
up to five pieces drawn from names, a value and the `?`, `#` and `&` delimiters. Its
oracle reads fragments with the WHATWG URL parser plus this conservative reading, and
checks four rules: no marker or marker value survives, ordinary fragments stay
byte-identical, fragments without `?` or `#` clean exactly as the form-data-only rule
did, and cleanup only removes entries, never rewrites them.

`src/jsx/__tests__/library/blog-sso-protocol.v1.json` is a byte-identical copy of the
issuer's canonical `web/src/lib/blog-sso-protocol.v1.json` in Laisky/laisky-blog-graphql.
It defines the reserved marker set, the return-route bound and the accepted or
rejected bookmark routes that both sides must agree on. Change both copies together,
keep them byte-identical, and bump `version` on any semantic change.

References reviewed 2026-11-04:

- RFC 3986 sections 3.5 and 4.2: <https://www.rfc-editor.org/rfc/rfc3986.html#section-3.5>
- RFC 6749 section 4.2.2: <https://www.rfc-editor.org/rfc/rfc6749.html#section-4.2.2>
- WHATWG URL application/x-www-form-urlencoded parser: <https://url.spec.whatwg.org/#concept-urlencoded-parser>
  (splits on `&` and skips empty sequences; the `URLSearchParams` string constructor first
  drops one leading `?`, per the Living Standard updated 19 October 2026).
- MDN, Function.prototype.apply (argument length limit, JavaScriptCore at 65,536):
  <https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Function/apply>
- Chromium URL display guidelines (2 MB URL limit):
  <https://chromium.googlesource.com/chromium/src/+/main/docs/security/url_display_guidelines/url_display_guidelines.md>
