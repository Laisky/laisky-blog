# Browser storage and failure reporting (2026-11-01)

Storage is optional and failures are reported. This records why, so neither
property is lost in a later change.

## Storage must not block reading

PouchDB has no timeout of its own. In a WebKit private session (a non-persistent
data store), its IndexedDB setup stores a Blob, WebKit fails that request with
`Error preparing Blob/File data to be stored in object store`, and the setup
transaction then neither completes nor aborts. Every later PouchDB call waits
forever. This is locale independent. Before this change, reading a language or
cache value hung, so articles failed after the 15-second page deadline with no
GraphQL request, and the article list stayed blank.

A separate route reaches the same hang: if `indexedDB.open()` throws synchronously,
as WebKit does when storage access is denied, PouchDB's module-level task queue
keeps `running = true` and queues every later open forever.

KV and cache storage therefore goes through `src/jsx/library/storage.js`. Direct
`sessionStorage` calls bypass it: scroll positions in `src/jsx/pages/pages.jsx` and the
SSO transaction in `src/jsx/library/sso.jsx`. `sessionStorage` is synchronous, so it
cannot hang the way PouchDB can, and those callers handle its errors themselves. They
have no deadline or page-memory fallback.

- Each operation has a 2-second deadline. The first timeout makes later calls
  fail fast, and one warning is reported per page. Only the timed-out operation's
  own late success clears this, because that proves the store was slow rather than
  unusable. An unrelated success proves nothing.
- `kvGet`, `kvSet`, `kvDel`, `getCache` and `setCache` never reject. Values fall
  back to page memory, which keeps language switching working.
- During an outage `kvDel` only hides a value for the page. `getCurrentUsername`
  reads the token strictly, so a sign-in that could not be read is not treated as
  missing and is never deleted.
- `kvGetStrict`, `kvSetStrict` and `kvDelStrict` reject. Sign-in uses these, because
  a session held only in page memory would disappear on reload while appearing to
  succeed. Sign-in in a private window fails visibly instead.
- `kvRestore` undoes a partial multi-key write even when the store is stalled, because
  a skipped rollback leaves the keys inconsistent once a slow store catches up.
- `requireUserToken` guards privileged requests, so they fail before being sent rather
  than carrying `Bearer null`.

### Change notifications

`kvSet` is the only source of change notifications. Registration through `kvSubscribe`
does no storage work, so it cannot fail or wait, and it returns its own unsubscribe
function. Components use the `useKvChange` hook, which ties the subscription to the
effect's lifetime, so it ends on unmount and survives StrictMode re-runs.

The js-utils listeners are deliberately not used. They fire only for writes made in the
same page, and every write now goes through `kvSet`, so they add nothing. Keeping both
paths caused duplicate delivery after a late write, lost delivery after a failed
registration, and removal-by-name races under StrictMode.

Playwright WebKit `newContext()` is non-persistent, like a private window. Use
`launchPersistentContext()` to represent a normal Safari profile.

## Handled failures do not reach Sentry on their own

The Sentry Loader listens only for `error` and `unhandledrejection`. A failure the
page catches, and a promise that never settles, produce neither. Each owning boundary
therefore calls `reportFailure` from `src/jsx/library/failureReport.js`.

A report made before the async SDK has loaded is held, up to 8 per page, and sent when the
Loader finishes. It sends `captureMessage` with allowlisted static labels and never the error text,
because a GraphQL `ClientError` message embeds the request and response. Message
events also do not start an on-error replay: with the SDK in buffer mode, an uncaught
throw uploaded a replay and `reportFailure` did not, so reporting does not increase
replay collection. It ignores `AbortError`. The historical-article catch is
deliberately not reported, because a denied archive is an expected authorization result.

## Reporting must not depend on the bundle

If the bundle is what failed, code inside it cannot report anything. The inline
`failure-reporting` script in `index.html` therefore loads the Sentry Loader before the
bundle, on URLs with no SSO callback marker. Callback URLs keep the existing rule and
load it from bootstrap after cleanup. Its marker list must match `SSOCallbackParameters`,
which `inlineTelemetry.test.js` enforces by running the shipped script for every entry.

Module scripts run before the window `load` event, so bootstrap sets
`window.__BLOG_APP_STARTED__`, clears it if mounting throws, and the inline script reports
`application_bundle failed (not_started)` if the flag is still unset at `load`. This
covers a 503, a network failure and an empty body, none of which raise a window `error`.
A truncated bundle also raises a global `SyntaxError`, so it produces two events. They
are kept separate: one carries the parser position and the other is a stable alert.

Reports cannot be sent when the SDK is blocked, and a callback URL whose bundle fails
reports nothing, because the SDK is deliberately absent there.

## Do not keep rendered JSX in state

The article editor once stored its rendered form in state and rebuilt it only when the route
or language changed. Everything that form closed over went stale: validation and request
errors never appeared, and the `submitting` guard could never take effect, so a second click
sent a second publish request. It now stores the loaded post and renders from it.
