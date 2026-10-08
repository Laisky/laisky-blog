# SSO callback containment and remaining protocol work

The current hosted SSO contract redirects to the blog with a reusable bearer in
`sso_token`. The frontend stores that same value for authenticated mutations.
Immediate history replacement reduces the time that same-page code can read the
callback query while local storage is pending. It preserves other query parameters
and the fragment, and does not change the existing issuer or mutation contract.
It cannot undo the initial HTTP request or remove previously captured URLs.

Issue [#188](https://github.com/Laisky/laisky-blog/issues/188) remains open until the
issuer, callback backend, and mutation authentication contract are agreed and
implemented together. The frontend must not invent an exchange endpoint or reject
all legacy callbacks before a compatible replacement exists.

The coordinated protocol change needs a short-lived, single-use code, transaction
state and PKCE binding, a trusted redemption backend, and issuer, audience, and
redirect validation. A cookie session design additionally needs Secure, HttpOnly,
SameSite and CSRF controls. See [OAuth Security BCP RFC 9700](https://www.rfc-editor.org/rfc/rfc9700.html#section-4.3.2).

The callback response also needs script isolation and reviewed referrer/cache
controls. Edge/origin logging, telemetry and diagnostics must redact authentication
parameters; deployed behavior must be verified with harmless canaries rather than
real credentials. These controls require deployment-owner coordination and are not
established by frontend unit tests.

The local regression uses synthetic unsigned JWT-like strings, mocks KV storage,
and forbids network calls. It checks that cleanup precedes asynchronous writes and
deletions, including interrupted and failing storage operations. Backend signature
verification is never exercised or bypassed by this test.
