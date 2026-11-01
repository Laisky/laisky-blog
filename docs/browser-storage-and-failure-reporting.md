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

All application storage therefore goes through `src/jsx/library/storage.js`:

- Each operation has a 2-second deadline. The first timeout makes later calls
  fail fast, and one warning is reported per page. A late success clears this,
  because it proves the store was slow rather than unusable.
- `kvGet`, `kvSet`, `kvDel`, `getCache` and `setCache` never reject. Values fall
  back to page memory, which keeps language switching working.
- During an outage `kvDel` only hides a value for the page. A value that could not
  be read is never deleted, so a slow store cannot sign a reader out permanently.
- `kvGetStrict`, `kvSetStrict` and `kvDelStrict` reject. Sign-in uses these, because
  a session held only in page memory would disappear on reload while appearing to
  succeed. Sign-in in a private window fails visibly instead.

Playwright WebKit `newContext()` is non-persistent, like a private window. Use
`launchPersistentContext()` to represent a normal Safari profile.

## Handled failures do not reach Sentry on their own

The Sentry Loader listens only for `error` and `unhandledrejection`. A failure the
page catches, and a promise that never settles, produce neither. Each owning boundary
therefore calls `reportFailure` from `src/jsx/library/failureReport.js`.

It sends `captureMessage` with allowlisted static labels and never the error text,
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
`window.__BLOG_APP_STARTED__` and the inline script reports
`application_bundle failed (not_started)` if the flag is still unset at `load`. This
covers a 503, a network failure and an empty body, none of which raise a window `error`.
A truncated bundle also raises a global `SyntaxError`, so it produces two events. They
are kept separate: one carries the parser position and the other is a stable alert.

Reports cannot be sent when the SDK is blocked, and a callback URL whose bundle fails
reports nothing, because the SDK is deliberately absent there.
