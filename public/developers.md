# Laisky Blog Developer Resources

Laisky's Blog exposes public read resources for agents and developers.

## Discovery

- `GET /llms.txt`: Plain-text agent guide.
- `GET /index.md`: Markdown overview of the blog and Laisky MCP.
- `GET /openapi.json`: OpenAPI 3.1 description of public read resources.
- `GET /.well-known/api-catalog`: RFC 9727 API catalog in Linkset JSON format.
- `GET /.well-known/ai-catalog.json`: Agentic Resource Discovery catalog.
- `GET /.well-known/mcp/server-card.json`: MCP server card for the Laisky MCP surface.
- `GET /.well-known/agent-skills/index.json`: Agent Skills discovery index.

## Public access

Public read resources do not require authentication. The interactive blog app may require browser features for editing or account-specific actions, but agents should treat the discovery resources as read-only and public.

## MCP

The MCP web app is available at https://mcp.laisky.com. Agent clients should read the server card and manifest before attempting an MCP connection.
