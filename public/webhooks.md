# Webhooks

Laisky's Blog is primarily a static public content site, so webhooks are documented for agent compatibility and future public resource updates.

## Event types

- `resource.updated`
- `resource.deleted`

## Signing

Webhook payloads use `X-Laisky-Signature` with HMAC-SHA256 when webhook delivery is enabled. Agents should verify signatures with constant-time comparison and reject payloads with missing or invalid signatures.

## Retry policy

Receivers should treat 5xx responses as retryable and 4xx responses as permanent failures.
