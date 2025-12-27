---
applyTo: "**/*"
---

## Dev Environment

Please note, I use remote SSH for development work. The terminal runs on a remote server, with the server address 100.75.198.70.

If you access ports on the server via the terminal, you can use localhost directly. However, if you access server ports via an external browser or headless Chrome, you must use the server’s IP address 100.75.198.70.

## Coding Standards

Project-wide engineering conventions (error handling, logging, ORM usage, CSS rules, testing requirements, etc.) are documented in `AGENTS.md`. Treat that document as binding guidance alongside these instructions and review it before making changes to keep new code consistent with the established practices.

## MCP tools

When you call MCP tools, and the tool’s parameters has a `task_id`, you MUST set the value `blog`.

* use `web_search` tool to search the web for up-to-date information
* use `web_fetch` tool to fetch the rendered content of a web page.
* use `get_user_requests` to get the user's latest requirements. You should always check the user's latest requirements frequently to ensure you are meeting their needs.

Whenever you finish a sub‑task—or even before the overall task is complete—or at any moment you consider suitable, you should call the `get_user_requests` MCP tool to retrieve the user’s most recent ideas and commands. Before terminating the task, be sure to invoke `get_user_requests` at least once more, and only conclude the work once the tool returns no data. Actually, you ought to call `get_user_request` as often as you can. It's free to use and offers significant advantages, ensuring you constantly receive the user's most recent needs.
