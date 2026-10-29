# Laisky Blog Public Resources API MCP server

Laisky Blog Public Resources API is available as a hosted [Model Context Protocol](https://modelcontextprotocol.io) (MCP)
server, so AI agents such as Claude, ChatGPT, Cursor and VS Code can call it as tools.

| | |
| --- | --- |
| Server URL | `https://app.getelva.ai/mcp/elvademo/laisky-blog-public-resources-api` |
| Install page | https://app.getelva.ai/mcp/elvademo/laisky-blog-public-resources-api/install |
| Tools | 16, one per operation in [`openapi.json`](public/openapi.json) |
| Calls | `https://blog.laisky.com` |
| Authentication | None, the API is public. |

## Install

**[Open the install page](https://app.getelva.ai/mcp/elvademo/laisky-blog-public-resources-api/install)** for step-by-step setup in Claude, ChatGPT,
Cursor, VS Code and other clients, or use one of the options below.

[![Install in Cursor](https://cursor.com/deeplink/mcp-install-dark.svg)](https://cursor.com/en/install-mcp?name=Laisky%20Blog%20Public%20Resources%20API&config=eyJ1cmwiOiJodHRwczovL2FwcC5nZXRlbHZhLmFpL21jcC9lbHZhZGVtby9sYWlza3ktYmxvZy1wdWJsaWMtcmVzb3VyY2VzLWFwaSJ9)
[![Install in VS Code](https://img.shields.io/badge/VS_Code-Install_MCP-0098FF?logo=visualstudiocode&logoColor=white)](https://insiders.vscode.dev/redirect/mcp/install?name=laisky-blog-public-resources-api&config=%7B%22type%22%3A%22http%22%2C%22url%22%3A%22https%3A%2F%2Fapp.getelva.ai%2Fmcp%2Felvademo%2Flaisky-blog-public-resources-api%22%7D)

### Claude Code

```bash
claude mcp add --transport http laisky-blog-public-resources-api https://app.getelva.ai/mcp/elvademo/laisky-blog-public-resources-api
```

### Claude (claude.ai and Claude Desktop)

Settings → Connectors → **Add custom connector**, then paste the server URL.

### ChatGPT

Settings → Apps & Connectors → Advanced settings → turn on **Developer mode**, then
**Create** a connector and paste the server URL.

### Any other MCP client

```json
{
  "mcpServers": {
    "laisky-blog-public-resources-api": {
      "url": "https://app.getelva.ai/mcp/elvademo/laisky-blog-public-resources-api"
    }
  }
}
```

---

Generated from this repository's OpenAPI spec and hosted by [Elva](https://getelva.ai?utm_source=github&utm_medium=Laisky/laisky-blog&utm_campaign=githubprs).
