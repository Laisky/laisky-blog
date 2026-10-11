# SSO callback containment and code-flow rollout

The earlier containment patch removed sso_token before asynchronous storage work.
It could not remove the reusable bearer from the initial HTTP request, and it
continued to accept that value as a new session. A local loopback request-target
canary and mocked regression reproduced those remaining behaviors.

The frontend now rejects legacy query bearers without clearing existing stored
sessions. Its opt-in single-use code flow binds state and PKCE, strips callback
markers synchronously, consumes the initiating tab transaction once, and exchanges
the code at the fixed issuer endpoint. Optional telemetry starts only after
callback handling and remains disabled if marker cleanup fails.

See [the complete code-flow contract](sso-code-flow.md) for exact endpoint, lifetime,
storage compatibility, failure handling, and primary protocol references.
The matching issuer implementation in Laisky/laisky-blog-graphql must be reviewed,
landed, and deployed before deploying this frontend. This change does not migrate
sessions to cookies or alter mutation authorization, JWT grants, or JWT lifetime.

Issue [#188](https://github.com/Laisky/laisky-blog/issues/188) still requires
coordinated deployment verification: edge/origin log redaction and deployed
referrer/cache headers must be checked with non-secret canaries. A code still
appears in the initial request target; its single use, short lifetime, and PKCE
binding are enforced by the issuer rather than browser URL cleanup.

Retained unit tests mock all authentication I/O and use synthetic local-only
credentials. They cover valid exchange, legacy rejection, state and replay binding,
bounded timeout and response size, expiry, malformed responses, tab-storage failure,
partial auth-write rollback, and history-cleanup failure. Browser JWT decoding
is a UI convenience, never a substitute for server verification.
