# Laisky Blog Public API

The public API surface is intentionally small and read-only. It exists to help agents discover canonical resources without scraping the JavaScript app.

## Endpoints

- `GET /api`: Returns a JSON index of public resources.
- `GET /openapi.json`: Returns the OpenAPI 3.1 document.
- `GET /llms.txt`: Returns the canonical agent guide.
- `GET /index.md`: Returns the Markdown homepage overview.
- `GET /.well-known/api-catalog`: Returns the RFC 9727 API catalog.
- `GET /.well-known/ai-catalog.json`: Returns the Agentic Resource Discovery catalog.

## Errors

Static resources return standard HTTP status codes. Agents should treat non-2xx responses as retryable only when the response status or headers indicate a transient condition.
