# Autopsy: Safari Private Browsing Broke Articles, and Sentry Never Saw It

- Status: Root cause confirmed on real WebKit. The fix is in open PR #205 and is **not deployed**. Not yet confirmed on a physical iPhone.
- Date: 2026-11-01
- Area: browser storage, failure reporting, error monitoring
- Audience: frontend engineers and whoever operates blog.laisky.com
- Related: [PR #205](https://github.com/Laisky/laisky-blog/pull/205), [cloudflare-workers#9](https://github.com/Laisky/cloudflare-workers/pull/9), issues #198 and #199, [storage and reporting design](../browser-storage-and-failure-reporting.md)

## 1. Summary

A reader whose iPhone uses Traditional Chinese opened an article and saw two messages:

> Language preferences are unavailable. Reload the page to try again.
>
> This article could not be loaded.

It looked like a language problem. It was not. Language has no effect on this failure.

In a WebKit private session, the IndexedDB setup inside PouchDB never finishes, and PouchDB has no timeout. The blog stored its language preference there, and read that preference before doing anything else. Every storage call hung, so the page's 15-second deadlines expired and both messages appeared at once, without a single article request being sent.

Sentry received nothing because of three separate gaps. Sentry only heard uncaught errors, recent work had caught all of these errors for the reader's benefit, and Sentry had been moved inside the bundle it was meant to monitor.

The investigation also raised a false alarm about the Cloudflare Worker, recorded in [section 7](#7-false-alarm-the-cloudflare-worker) so that nobody repeats it.

| Claim                                                                             | Confidence                                                                                                           |
| --------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| A WebKit private-equivalent session fails this way, and a normal session does not | **Confirmed** on real WebKit 27.2 with no fault injected                                                             |
| Locale has no effect                                                              | **Confirmed** in Chrome and WebKit, `zh-TW` against `en-US`                                                          |
| Handled failures never reached Sentry                                             | **Confirmed** with the real SDK, using a positive control                                                            |
| Safari private windows reject Blobs in IndexedDB                                  | Published by a third party, and matches what WebKit did here                                                         |
| The reporter was in Private Browsing                                              | **Inferred** from a dark address bar on a light page, and from the identical screen. Not confirmed with the reporter |
| The same happens on a physical iPhone                                             | **Not tested**                                                                                                       |

## 2. Impact

- **Who:** by mechanism, every visitor in a Safari private window, in any language. Normal Safari sessions and Chrome are not affected.
- **What they saw:** articles failed after about 15 seconds, and retrying could not help. The article list stayed blank.
- **How many:** unknown. Sentry has no record of these failures, and a failed visit looks like a normal page load in its trace data.
- **Since when:** unknown. The language preference has been stored this way since early 2025. Before #198 on 2026-10-13 the code had no deadline, so by code reading the same hang would have shown an endless loading state, not an error.
- **Data:** nothing was lost or corrupted.

## 3. Why It Looked Like a Language Problem

The first message names language, and the reporter's language was the unusual detail. Both were coincidental.

`zh-TW` is normalized to `zh_CN`, the same as Simplified Chinese, so a Traditional Chinese reader takes the same path as any Chinese reader. The API answered normally with `zh-TW` headers in both languages. The message mentions language only because reading the language preference was the first storage call to hang.

## 4. Root Cause

The failure is a chain, and each link is needed:

1. Safari private windows [cannot store a Blob in IndexedDB](https://underpassapp.com/news/2025/9/4.html). The request fails with `Error preparing Blob/File data to be stored in object store`.
2. PouchDB 9 attempts exactly that during setup, to detect Blob support.
3. In a transaction shaped like that setup, real WebKit neither completed nor aborted. PouchDB waits for that transaction with no timeout, so its `get` never settled.
4. `getUserLanguage` awaited that read, and it was the first step of both the application shell and the article page.
5. Each had its own 15-second deadline, so both failed together, before any GraphQL request.

Real WebKit 27.2, with nothing injected:

| Case                 | Private-equivalent session                         | Normal session   |
| -------------------- | -------------------------------------------------- | ---------------- |
| Article, `zh-TW`     | Failed at 15.8s, both messages, 0 GraphQL requests | Loaded in 1.3s   |
| Article, `en-US`     | Failed at 15.7s, both messages, 0 GraphQL requests | Loaded in 1.1s   |
| `/pages/0/`, `zh-TW` | Blank for over 20s                                 | Loaded in 1.5s   |
| Direct PouchDB `get` | Hung past 6s                                       | Answered in 35ms |

The underlying design fault is that **an optional dependency could block the required path**. A stored preference and a cache are conveniences, and neither should be able to stop someone reading an article.

Two other inputs reach the same screen:

- **`indexedDB.open()` throwing synchronously.** [WebKit does this when storage is denied](https://github.com/WebKit/WebKit/blob/main/Source/WebCore/Modules/indexeddb/IDBFactory.cpp). PouchDB's module-level task queue then stays locked, so the first call rejects and every later one hangs. This was reproduced with a stub, and real WebKit throws that error in an opaque origin. Whether the iOS "Block All Cookies" setting triggers it is unverified.
- **A non-string stored language.** `lang.toLowerCase()` threw, so the same two messages appeared immediately. Nothing in the code writes such a value, so this needs corrupted data.

### Contributing factors

- Browser qualification ran only on Chromium, and WebKit was not in the test matrix.
- Tests mocked storage as either working or rejecting. None modelled storage that never answers.
- `safeKvGet` caught rejections, which suggested storage failure was already handled. A hang is not a rejection.

## 5. Why Sentry Stayed Silent

The pipeline itself worked. An uncaught test error was reported in every scenario. The failures simply never reached it, for three independent reasons:

| Gap                              | Cause                                                                                                             | Introduced                     |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------------- | ------------------------------ |
| Handled failures were invisible  | The Sentry Loader listens only for `error` and `unhandledrejection`, and the repo had no explicit reporting calls | #198, merged 2026-10-13        |
| A hang is not an exception       | Nothing throws. The only signal was the 15-second timeout, and the same catch swallowed it                        | #198, which added the deadline |
| A broken bundle could not report | Sentry was moved from `index.html` into the bundle, so a bundle that failed to load or parse never loaded Sentry  | #195, merged 2026-10-23        |

#198 was a good change with an unnoticed side effect. It was opened because of Sentry issues, and it replaced unhandled rejections with visible, recoverable errors. Its acceptance test required that no `unhandledrejection` escape, which also removed the only input the Loader had. The issue asked for each failure to be surfaced or reported once at its owning boundary, and the reporting half was not built.

#195 moved Sentry for a sound reason: to keep the SDK away from SSO callback URLs.

Measured with the real production bundle and SDK, with ingest answered locally:

| Scenario                  | What the reader saw       | Sentry error events               |
| ------------------------- | ------------------------- | --------------------------------- |
| Storage hang              | Both messages             | 0                                 |
| `indexedDB.open()` throws | Both messages             | 0                                 |
| GraphQL down              | Article failed            | 0                                 |
| Truncated bundle or 503   | Application never mounted | 0, and Sentry was never requested |
| Uncaught throw (control)  | None                      | 1                                 |

## 6. Timeline

All times are UTC.

| When                      | Event                                                                                |
| ------------------------- | ------------------------------------------------------------------------------------ |
| 2024-09-28                | Sentry Loader added to `index.html`                                                  |
| 2025-02 to 03             | Language preference moved to stored KV, later through `@laisky/js-utils` and PouchDB |
| 2026-10-13                | #198 merges with PR #200, adding deadlines and catches                               |
| 2026-10-23 14:33          | #195 merges, moving Sentry into the bundle. Production's HTML dates from 14:34       |
| 2026-11-01 about 03:35    | Investigation begins from the reader's screenshot                                    |
| 2026-11-01 03:45 to 04:15 | Repeated bundle fetches during testing trigger 52 Worker limit errors                |
| 2026-11-01 14:21          | PR #205 opened                                                                       |
| 2026-11-01 about 14:45    | `/assets/*` removed from the Worker's routes                                         |
| 2026-11-01 14:54          | cloudflare-workers#9 merged                                                          |
| 2026-11-01 15:13          | PR #205 review findings answered                                                     |
| 2026-11-01 about 16:30    | Unknown-language fallback tightened                                                  |

## 7. False Alarm: The Cloudflare Worker

During the investigation, 33 of 38 fetches of the main bundle were bad: 18 were truncated 200 responses and 15 were 503 `Error 1102: Worker exceeded resource limits`. This was reported as an urgent production problem. **That was wrong.**

Workers Analytics showed the real picture:

| Period (`blog` Worker)                       | `exceededResources` |
| -------------------------------------------- | ------------------- |
| Oct 2 to Oct 31, about 166,000 requests      | 0                   |
| Nov 1, 03:45 to 04:15, during the test burst | 52                  |
| The rest of Nov 1                            | 0                   |

The failures were almost certainly triggered by the investigation's own repeated fetches, and there is no evidence that visitors hit them. They also did not cause the reported screen: that page rendered, so its bundle had arrived intact. The limit errors also do not support a link to Sentry groups G5 and G6 in #199, which fell in a window with no such errors.

Removing `/assets/*` from the Worker's routes was still kept, as risk reduction rather than a fix:

- Cloudflare's cache already serves these files, so the Worker added nothing.
- The 2.2 MB bundle is over the Worker's 1 MiB body limit, so it was pumped through JavaScript on every request.
- Assets are `immutable` for 31 days, and Chrome and WebKit both reused a truncated copy without refetching it, so one bad response could stick.

Whether CPU or memory caused the errors is unknown, and so is whether truncated responses count as `exceededResources`. The change was applied with `wrangler triggers deploy`, so no Worker code was uploaded.

## 8. Other Defects Found

The behaviour tests written for PR #205 exposed defects that nobody had reported:

| Defect                                                                                                                                   | Origin                                                             |
| ---------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| The article editor never showed validation or request errors, and a second click published twice, because rendered JSX was kept in state | Already on `v2`                                                    |
| Edits and batch updates sent `Authorization: Bearer null` when no token was available                                                    | Already on `v2`                                                    |
| A single failed token read deleted a valid sign-in                                                                                       | Already on `v2`                                                    |
| A sign-in rollback was skipped after a storage timeout                                                                                   | Introduced by the first version of PR #205, and fixed before merge |

A language check on 2026-11-01 confirmed that unknown languages such as `fr`, `ja` and `ar` fall back to English, both in tests and on the deployed site. It also found two gaps. `startsWith('zh')` treated codes such as `zha` (Zhuang) and `zhabc` as Chinese, and a non-string stored value threw. The check now matches the whole `zh` subtag and treats anything else as English.

## 9. Remediation

| Change                                                                                        | Status                                       |
| --------------------------------------------------------------------------------------------- | -------------------------------------------- |
| All KV and cache access bounded by a 2-second deadline, with a page-memory fallback           | PR #205                                      |
| One change-notification path, with subscriptions tied to components                           | PR #205                                      |
| Handled failures reported with static allowlisted labels, which do not trigger session replay | PR #205                                      |
| Sentry loaded before the bundle, except on SSO callback URLs                                  | PR #205                                      |
| A bundle that never started is reported                                                       | PR #205                                      |
| Unknown languages fall back to English                                                        | PR #205                                      |
| `/assets/*` removed from the `blog` and `blog-dev` routes                                     | **Live**, and merged in cloudflare-workers#9 |

PR #205 is still being refined. Its description and the [design document](../browser-storage-and-failure-reporting.md) hold the final implementation details.

**The reported failure is still live.** Production was serving `index-DCw8A9rV.js` from 2026-10-23 when this was written, so Safari private windows remain affected until PR #205 is deployed.

## 10. Verification

- The final regression tests fail on the pre-fix source, and their controls pass there.
- On the built site in real WebKit, a private-equivalent session loads articles and the list in about 3.5 seconds with no failure message, and language switching works. Normal sessions are unchanged.
- The extra time in private sessions is the 2-second storage deadline on the first read.
- With the real SDK, each failure mode above now reports. A report made before the SDK loads is held and delivered once.
- No test events reached the Sentry project from these runs. The first browser run did send 8 ordinary page-load transactions, with no error events.

The limit that matters: WebKit here was the desktop WPE build, in a non-persistent session, and not iOS Safari.

## 11. Open Items

| Item                                                                                                                                                                                              | Owner      |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| Merge and deploy PR #205                                                                                                                                                                          | Maintainer |
| After deploying, open an article in an iPhone Private tab. It should load after a short delay                                                                                                     | Maintainer |
| Ask the reporter whether they were in Private Browsing                                                                                                                                            | Maintainer |
| Add Sentry alert rules on the `blog_operation` tag. Treat `browser_storage` as a trend, not a page, because every private-window visitor produces it                                              | Maintainer |
| Decide whether PouchDB is still justified for simple key-value use. Removing it would remove the setup that causes this failure                                                                   | Maintainer |
| Decide what to do with the Worker's HTML cache, which never stores because responses carry `no-store`, and find the source of the contradictory `public, max-age=86400, immutable` in that header | Maintainer |
| Add WebKit to browser qualification, in both private and normal sessions                                                                                                                          | Maintainer |
| Keep #199 open: G5 and G6 remain unexplained                                                                                                                                                      | Maintainer |

## 12. Lessons

- **Optional dependencies must not be able to block required work.** Give anything optional a deadline, and a fallback that lets the page continue.
- **A hang is a failure mode of its own.** A `try/catch` proves nothing about a promise that never settles, so test with storage that never answers.
- **Catching an error removes it from global handlers.** When a change handles an error for the reader, it must also report it, in the same change.
- **Monitoring must not depend on what it monitors.** A reporter loaded by the bundle cannot report a broken bundle.
- **Test the mode, not just the browser.** Private sessions behave differently from normal ones, and Playwright's `newContext()` is non-persistent like a private window, while `launchPersistentContext()` matches a normal profile.
- **Error text shapes the diagnosis.** A message naming the first thing that broke can send everyone towards the wrong cause.
- **Check your own traffic before calling an incident.** Status analytics would have settled the Worker question in minutes. Space out live sampling, and look for the same failure before your investigation began.
- **Behaviour tests find what review misses.** A suggested fix for the editor looked correct, but only a test showed the reader would never see the error.

## 13. References

- [Detecting private windows in Safari](https://underpassapp.com/news/2025/9/4.html) (Underpass App Company)
- [WebKit `IDBFactory.cpp`](https://github.com/WebKit/WebKit/blob/main/Source/WebCore/Modules/indexeddb/IDBFactory.cpp)
- [PouchDB issue #9167](https://github.com/apache/pouchdb/issues/9167)
- [Cloudflare Workers limits](https://developers.cloudflare.com/workers/platform/limits/)
- [React `useSyncExternalStore`](https://react.dev/reference/react/useSyncExternalStore)
