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

The exchanged JWT continues to use the existing auth_user/user_token keys and
Authorization bearer path; existing stored sessions remain compatible. Partial
writes attempt to restore previous keys when storage permits; callback handling and
application bootstrap wait until both recovery attempts settle. These separate KV
writes are not atomic: a permanently failing restore can leave mixed user/token
values. Waiting preserves the generic error but does not guarantee restoration.
JWT decoding and expiry
checks are UI sanity checks, not signature verification or server authorization.
The mutation backend still enforces authorization. This change does not migrate
sessions into cookies or change JWT scope or lifetime.

The document sets no-referrer before external resource loading. Optional
telemetry initializes after callback consumption and remains disabled if any
callback marker survives cleanup. Existing Nginx root response configuration
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
auth_user/user_token. If history cleanup fails, the existing static error gate
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
