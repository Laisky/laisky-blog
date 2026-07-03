---
name: laisky-blog
description: Use when an agent needs to read Laisky's Blog, discover Laisky MCP resources, or cite canonical public metadata from blog.laisky.com.
---

# Laisky Blog Skill

Use this skill when the user asks about Laisky's Blog, Laisky MCP, public engineering articles, RSS resources, or machine-readable discovery documents on `blog.laisky.com`.

## Workflow

1. Start with `https://blog.laisky.com/llms.txt` for the compact overview.
2. Use `https://blog.laisky.com/index.md` when a Markdown homepage is needed.
3. Use `https://blog.laisky.com/openapi.json` for machine-readable public resource endpoints.
4. Use `https://blog.laisky.com/.well-known/mcp/server-card.json` before attempting MCP-specific work.
5. Use `https://mcp.laisky.com` when the user explicitly needs the MCP web app.

## Constraints

Do not invent private APIs, paid plans, credentials, or user-specific data. Public resources are read-only. If the browser app requires login or another manual step, stop and ask the user to complete that step.
