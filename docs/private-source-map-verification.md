# Offline source-map verification

Issue #199 tracks five historical syntax groups whose causes remain unconfirmed. This procedure prepares evidence for a future private mapping integration; it does not configure Sentry, upload artifacts, add a release to browser events, or identify a historical event.

Vite's `hidden` option omits source-map comments but still emits map files. The production image serves the entire `dist` directory, so never put a hidden-map build there or inside the Docker build context. See [Vite build options](https://vite.dev/config/build-options#build-sourcemap).

From a clean, immutable checkout with frozen dependencies, first create the normal deployment build. Use the exact output destined for deployment as `dist`, not an assumed equivalent rebuild. Create a private temporary directory outside the repository with restricted permissions, then build maps there:

```sh
umask 077
private_build="$(mktemp -d)"
yarn build
yarn vite build --sourcemap hidden --outDir "$private_build"
python3 .scripts/verify_private_maps.py dist "$private_build"
```

The verifier resolves the three root paths first, then rejects links encountered inside either build tree, a private build inside or containing the repository, extra maps, changed script names, changed script bytes, and maps that fail basic shape checks (including sources/content types and lengths and allowed mapping characters). It does not decode VLQ segments or validate source positions. It fails closed for mapless scripts unless their path and content hash match the exact outputs in `QUALIFIED_MAPLESS`. That list is an inspection record for this Vite 8 build, not a claim that those files have source mappings. Changes to dependencies or the build can change the list: inspect each new mapless asset before updating it, or leave verification failing.

The observed 17 mapless files comprise 16 generated import/re-export wrappers and one Rolldown runtime helper containing executable code. None has an original-source map; notably, runtime exceptions in the helper cannot be mapped by this procedure. Qualifying their byte identity does not establish complete mapping coverage.

The manifest records SHA-256 hashes of each relative asset path, asset bytes and corresponding map; a null map hash denotes an explicitly qualified mapless script. Hashing paths prevents a sensitive filename from being printed. To match a known public asset path, hash its UTF-8 relative path locally and compare its hash. Treat the map directory as sensitive source material, keep it private, and delete it when no longer needed. Do not include the private directory in deployment or CI artifacts without a separately approved private storage process.

Matching bytes and the shallow map shape checks are necessary but do not prove the positions resolve correctly, that a deployment serves these bytes, or that a particular Sentry event references them. Record the actual image digest, commit, environment and served asset hashes alongside any release receipt. Qualify a known generated position against its source, and check each unmapped script before relying on mapping coverage. Sentry matching, private upload and a synthetic production event require separate authorization. [Sentry's troubleshooting guide](https://docs.sentry.io/platforms/javascript/sourcemaps/troubleshooting_js/) describes artifact matching and why uploads do not retroactively map earlier events.

The CDN loader initializes before the application module on clean URLs and after callback cleanup on SSO URLs. This change leaves that ordering and all event collection unchanged. Existing static handled-failure reports are not proof that automatic SDK events are scrubbed; release/environment attribution and whole-event privacy validation remain open work.

## Offline event adapter and candidate identity

`src/jsx/library/sentryEventPrivacy.js` contains an opt-in adapter for the documented `sentryOnLoad` initialization hook. It is **not connected to either production loader path**. Its `beforeSend` constructs a new error event from a small allowlist: approved same-origin built-script filenames, line and column, exception type, level, event ID, timestamp, and static handled-failure labels. Unknown messages, arbitrary tags, request data, user data, breadcrumbs, DOM/storage and frame variables are omitted. The adapter preserves the bundle-startup diagnostic and the existing static handled-failure groups. Unapproved or third-party frames are omitted. It is a candidate with diagnostic tradeoffs: arbitrary error messages and function names are deliberately lost, and an error with no approved frame cannot be mapped.

To produce its candidate configuration, first review the script paths from the actual deploy tree and save an exact JSON array of relative paths to a private file. The next command **prints those reviewed paths**, so never approve paths containing secrets. Its other output is the validated commit, environment, origin, and a SHA-256 of canonical sorted `[path, script SHA-256]` pairs. The digest identifies the JavaScript set, not the HTML, CSS, other assets, image digest, or an entire deployment. The supplied commit is a claim that must be linked independently to the build receipt; the script cannot establish that provenance.

```sh
python3 .scripts/create_offline_sentry_config.py dist "$private_build" \
  --approved-assets /private/reviewed-script-paths.json \
  --commit "$full_source_commit" --environment staging --origin https://blog.example
```

Both the clean-URL inline loader and post-callback loader were exercised with an intercepted SDK fixture and a manually installed adapter. This does not enable the adapter in the page. Before any activation, qualify the exact CDN loader and SDK initialization, configure the hook before **either** loader insertion while retaining callback gating and early parse-error capture, and verify that the identity comes from the actual release artifact. `beforeSend` only covers error/message events: transactions, sessions, Replay, attachments, other envelopes and server-derived IP handling need separate qualification. Local canary tests cannot establish those channels' privacy. No upload, production test event, or service configuration change is part of this procedure.
