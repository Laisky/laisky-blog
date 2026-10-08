# Blog release delivery verification

The previous remote script ran legacy `docker-compose`, then `docker ps`. A failed rollout therefore returned the successful status of `docker ps`. The installed Compose v1 also rejected an unrelated service's `create_host_path` option while parsing the shared configuration. The public HTML continued to select the old entry bundle after the workflow reported success.

The release keeps both existing image builds and the existing SSH deployment action. Deployment consumes the hash build's immutable digest and exact source commit, verifies its OCI revision label, and uses the already-installed `docker compose` v2 command. The prior running image ID is captured before the pull.

The helper verifies the existing `vps` project and `blog-v2` service labels, creates a temporary override containing only that service's image, and recreates only `blog-v2` with `--no-deps --no-build --pull never`. It does not remove orphan containers. The temporary override is removed on completion.

Acceptance requires the running image ID, successful container-local Nginx validation, one hashed entry script in the local HTML, matching container-loopback HTTP HTML/JavaScript, matching public HTML, and identical local/public JavaScript SHA256. Container HTTP checks use the image's existing BusyBox `wget`; no tool installation is performed. Public requests use normal HTTPS certificate validation, fixed canonical URLs, bounded sizes, timeouts, and three attempts. They do not execute article content or call authenticated APIs. No cache purge is performed.

A rollout or acceptance failure attempts restoration of the prior immutable local image using the same scoped Compose command. Restoration must pass the same local/public acceptance checks. The release still exits unsuccessfully after successful rollback, and reports rollback verification failure separately.

Release workflows use one concurrency group with cancellation disabled. GitHub does not guarantee queue ordering, so immediately before SSH the runner checks the current `v2` branch SHA. A superseded commit skips every remote action; failed or malformed branch lookups fail closed.

## Retained tests

Run the fast mocked controls without Docker, network access, or a production host:

```sh
python3 -m unittest discover -s .scripts -p test_deploy_blog.py -v
```

The tests reproduce the old masked Compose failure and cover failed shell exit propagation, reordered/failed branch lookups, exact image/source identity, project/service scope, stale public HTML, mismatched public JavaScript, rollout and Nginx failures, successful rollback, failed rollback, and public transport failure. The normal Fast CI workflow runs these fast controls alongside its existing formatting and essential frontend units; full frontend qualification remains local.

## Delivery verification

After the normal merged release, retain the exact workflow commit, image digest, accepted entry script name, and script SHA256. Verify ordinary and registered-history article reads and unknown-history denial in a fresh bounded browser context. Preserve the existing authored HTML and Slide behavior. Check SSO URL containment using a synthetic invalid token inserted after clean navigation; do not use real credentials or account actions.

The helper verifies delivery identity rather than the full application behavior. The historical archive and SSO regressions remain in their existing unit and local browser suites.

The conservative serial command budget is 1,038 seconds: preflight/pull is at most 250 seconds, each scoped rollout is 90 seconds, and each three-attempt acceptance is 304 seconds. Quick Docker and public HTTP reads have ten-second process deadlines. SSH allows 25 minutes and the deployment job allows 30 minutes, leaving time for rollback and wrapper overhead without enlarging Fast CI.

## References

- [Docker Compose up options and error exit status](https://docs.docker.com/reference/cli/docker/compose/up/)
- [Docker build-push-action digest output](https://github.com/docker/build-push-action)
- [SSH action environment forwarding](https://github.com/appleboy/ssh-action)
- [GitHub concurrency behavior](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/control-workflow-concurrency)
