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

The verifier rejects maps in the supplied deployment tree, links, a private build inside the repository, extra maps, changed script names, changed script bytes and empty or structurally invalid maps. Its output records SHA-256 hashes for the deployed JavaScript and corresponding maps; a null map hash marks a script for which Vite emitted no map. Treat the map directory as sensitive source material, keep it private, and delete it when no longer needed. The hashes alone contain no source contents. Do not include the private directory in deployment or CI artifacts without a separately approved private storage process.

Matching bytes and a nonempty map are necessary but do not prove the positions resolve correctly, that a deployment serves these bytes, or that a particular Sentry event references them. Record the actual image digest, commit, environment and served asset hashes alongside any release receipt. Qualify a known generated position against its source, and check each unmapped script before relying on mapping coverage. Sentry matching, private upload and a synthetic production event require separate authorization. [Sentry's troubleshooting guide](https://docs.sentry.io/platforms/javascript/sourcemaps/troubleshooting_js/) describes artifact matching and why uploads do not retroactively map earlier events.

The CDN loader initializes before the application module on clean URLs and after callback cleanup on SSO URLs. This change leaves that ordering and all event collection unchanged. Existing static handled-failure reports are not proof that automatic SDK events are scrubbed; release/environment attribution and whole-event privacy validation remain open work.
