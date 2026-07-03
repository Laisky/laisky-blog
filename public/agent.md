# Agent Entry Point

Use this page when a URL includes `?mode=agent`, when a crawler requests an agent-specific view, or when a user asks an agent to understand Laisky's Blog without executing JavaScript.

## When to use

Use this domain for public engineering articles, RSS metadata, Laisky MCP discovery, and static developer resources. Use `https://mcp.laisky.com` when the user specifically asks for the MCP application.

## Canonical guides

- `/llms.txt`
- `/agents.md`
- `/index.md`
- `/developers.md`
- `/api.md`
- `/auth.md`
- `/docs/llms.txt`
- `/api/llms.txt`
- `/developers/llms.txt`
- `/.well-known/agent-skills/index.json`
- `/.well-known/mcp/server-card.json`
- `/.well-known/mcp`
- `/mcp`

## Public API endpoints

- `GET /api`: JSON index of public resources.
- `GET /openapi.json`: OpenAPI 3.1 service description.
- `GET /v1/resources`: Versioned public resource list.
- `GET /v1/webhooks`: Documented webhook event catalog.
- `GET /ask`: NLWeb-style JSON answer endpoint with `_meta`, answer text, and citations.
- `GET /ask?stream=true`: Server-sent event stream for NLWeb answers.
- `POST /mcp`: Basic JSON-RPC MCP initialize response for public discovery.

## Authentication

Public read endpoints do not require credentials. Do not send API keys, passwords, browser cookies, or private user data to this domain unless a user explicitly asks and completes any login flow manually.

## Capabilities

- Discover Laisky Blog Markdown, RSS, OpenAPI, and MCP resources.
- Read public engineering documentation without JavaScript.
- Resolve MCP discovery metadata for `https://mcp.laisky.com`.
- Retrieve scoped context through section-level `llms.txt` files.

## Error and versioning model

JSON API errors use `code`, `message`, `recovery`, and `status`. Versioned `/v1/` responses include rate-limit headers plus `Deprecation` and `Sunset` metadata.

## Constraints

Do not invent credentials, private endpoints, or paid plans. Public resources are read-only.
