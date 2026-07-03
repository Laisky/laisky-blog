# Authentication for Laisky Blog Agents

Public discovery resources on `blog.laisky.com` do not require authentication.

## Public resources

- `/llms.txt`
- `/index.md`
- `/openapi.json`
- `/.well-known/api-catalog`
- `/.well-known/ai-catalog.json`
- `/.well-known/mcp/server-card.json`
- `/.well-known/agent-skills/index.json`

## Browser-only flows

Some interactive blog actions may require browser login or manual user steps. Agents must not attempt to bypass those steps. If an action requires a signed-in session, tell the user what is needed and wait for them to complete it.

## OAuth metadata

OAuth protected resource metadata is published at `/.well-known/oauth-protected-resource` for clients that perform standardized discovery.
