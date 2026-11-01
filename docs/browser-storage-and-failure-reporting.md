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
- During an outage `kvDel` only hides a value for the page. That is right for a
  preference and wrong for anything a reload must not bring back.
- `kvGetStrict`, `kvSetStrict` and `kvDelStrict` reject, for callers that cannot
  accept page memory as an answer.
- `kvRestore` puts a value back after a failed write even when the store is stalled,
  because a write that timed out can still commit.

### The session has different rules

`src/jsx/library/session.js` owns the session, and nothing else touches its keys.
These invariants are enforced by `sessionInvariants.test.jsx`:

- Reading survives a storage failure.
- Sign-in never succeeds without a durable token. Sign-in in a private window fails
  visibly instead, because a session held in page memory would vanish on reload.
- Logout never claims success while a token may remain. The token delete is strict and
  ignores the stalled flag, because a page memory tombstone would end at the reload and
  the session would return when storage recovers. On failure the page stays as it is
  and says so.
- The displayed identity always matches the token sent with privileged requests. Both
  come from `user_token`: the token is one key, so a session changes in one write and
  needs no multi-key rollback. Every release stored `auth_user` as the decoded token, so
  dropping it changes no name, and leftover values are ignored until removed.
- `getCurrentUsername` reads the token strictly, so a sign-in that could not be read is
  not treated as missing and is never deleted.
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
Loader finishes. A held report the SDK refuses is dropped without costing the others. It sends `captureMessage` with allowlisted static labels and never the error text,
because a GraphQL `ClientError` message embeds the request and response. Message
events also do not start an on-error replay: with the SDK in buffer mode, an uncaught
throw uploaded a replay and `reportFailure` did not, so reporting does not increase
replay collection. It ignores `AbortError`.

A denied archive is an expected authorization result, so it is not reported. Everything
else on a historical article is, including a network failure, a gateway failure and a
database failure. `isHistoryDenial` in `src/jsx/pages/historyDenial.js` tells them apart by
the backend's fixed GraphQL messages, because the backend sends no error code. The denial
for an unknown archive shares its prefix with a database failure, so it is matched whole.
If the wording changes, denials get reported rather than failures being silenced.

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

The check at `load` does not need a retry for a late SDK. The Loader is inserted during
parsing, so the window `load` event waits for it to run or fail, and the Loader's own
`Sentry.captureMessage` buffers until the full SDK arrives. This was measured in Chrome
and Firefox with the Loader delayed by 0, 1.5 and 5 seconds beside a 503 bundle: it always
ran before `load` and the event was captured. If it is blocked, there is nothing to wait for.

Reports cannot be sent when the SDK is blocked, and a callback URL whose bundle fails
reports nothing, because the SDK is deliberately absent there.

## Do not keep rendered JSX in state

The article editor once stored its rendered form in state and rebuilt it only when the route
or language changed. Everything that form closed over went stale: validation and request
errors never appeared, and the `submitting` guard could never take effect, so a second click
sent a second publish request. It now stores the loaded post and renders from it.
