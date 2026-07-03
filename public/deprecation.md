# API Versioning and Deprecation

The public resource API uses URL versioning under `/v1/`.

## Current version

`v1` is current and not deprecated.

## Headers

Versioned API responses include:

- `Deprecation: false`
- `Sunset: Fri, 31 Dec 2027 23:59:59 GMT`
- `Link: <https://blog.laisky.com/deprecation.md>; rel="deprecation"; type="text/markdown"`

Agents should monitor these headers before caching endpoint behavior.
