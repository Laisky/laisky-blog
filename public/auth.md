# Authentication for Laisky Blog Agents

Public discovery resources on `blog.laisky.com` do not require authentication.

## 1. Public resources

- `/llms.txt`
- `/index.md`
- `/openapi.json`
- `/.well-known/api-catalog`
- `/.well-known/ai-catalog.json`
- `/.well-known/mcp/server-card.json`
- `/.well-known/agent-skills/index.json`

## 2. OAuth protected resource metadata

Read `/.well-known/oauth-protected-resource` first. It identifies this resource server, supported scopes, bearer-token placement, and the authorization server metadata URL.

## 3. Authorization server metadata

Read `/.well-known/oauth-authorization-server` next. The metadata advertises the `public.read` scope, PKCE S256 support, and an `agent_auth` block for agents that need a structured registration template.

## 4. Registration

No registration is required for public read resources. If a future private workflow is added, the agent should use the `agent_auth.registration_template` value from authorization server metadata and ask the user before submitting any account-specific information.

## 5. Pick a method

Pick zero-auth public read access for `public.read` resources. Use OAuth authorization code with PKCE only if a future private resource explicitly asks for it.

## 6. Claim

Claim only the `public.read` scope for static resources. Do not claim write, admin, payment, or account scopes.

## 7. Use credential

No credential is required for public resources. If a future credential is issued, send it as `Authorization: Bearer <token>` and never place it in URLs, logs, or Markdown output.

## 8. Revocation

No revocation is needed for zero-auth public resources. If a future user credential is issued, discard it after the task and direct the user to the account UI for revocation.

## 9. Authorization

Public resources are zero-auth. Browser-only actions may require a user session and must be completed manually by the user.

## 10. Token exchange

No token exchange is needed for public read resources. Agents should not create or infer API keys.

## 11. Scopes

- `public.read`: Read public discovery documents and static metadata.

## 12. Error handling

API-style errors use JSON objects with `code`, `message`, and optional `recovery` fields. Retry only when the status code or response headers indicate a transient condition.

## Browser-only flows

Some interactive blog actions may require browser login or manual user steps. Agents must not attempt to bypass those steps. If an action requires a signed-in session, tell the user what is needed and wait for them to complete it.

## OAuth metadata

OAuth protected resource metadata is published at `/.well-known/oauth-protected-resource` for clients that perform standardized discovery.
