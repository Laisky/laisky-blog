---
applyTo: "**/*"
---

# Memory

Authoritative, abstract, and current guidance for everyone working in this repository. Keep it lean, remove stale details, and surface subtle decisions that are easy to miss elsewhere.

## Project Overview

`laisky-blog` is a Single Page Application (SPA) built with React 19 and Vite. It serves as the frontend for Laisky's blog, interacting with a GraphQL backend.

## Tech Stack

- **Framework:** React 19
- **Build Tool:** Vite
- **Routing:** react-router-dom v7
- **Styling:** SCSS, Bootstrap 5
- **API Client:** graphql-request
- **Utilities:** @laisky/js-utils, moment, marked (Markdown), mermaid (Diagrams)
- **Testing:** Vitest, React Testing Library

## Architecture & Conventions

### Routing

- Defined in `src/jsx/main.jsx`.
- Uses `createBrowserRouter` with nested routes.
- Main layout is handled in `src/jsx/pages/app.jsx`.

### Data Fetching

- **GraphQL:** Primary data source. Endpoint: `https://gq_v2.laisky.com/query/`.
- **Helper:** `src/jsx/library/base.jsx` exports `graphqlQuery` and `graphqlMutation`.
- **Caching:** `graphql-request` is used. `force=1` query param or `isForce()` check disables cache.

### Authentication & State

- **Auth:** JWT based. Token stored via `@laisky/js-utils` (KV storage).
- **User Info:** Decoded from JWT and cached.
- **Language:** Persisted in KV storage (`zh_CN` or `en_US`). Defaults to browser language.

### Styling

- **SCSS:** Located in `src/scss/`.
- **Bootstrap:** Imported and customized.
- **Theme:** Dark/Light mode support, auto-detects system preference.

## Development

- **Start Dev Server:** `make run` (runs `npm run dev`).
- **Port:** Default is 11300 (proxied or exposed via Docker/SSH).
- **Linting:** `npm run lint`.

## Deployment

- **Build:** `npm run build` (Vite build).
- **Docker:** Containerized with Nginx serving static assets (`deploy/nginx.conf`).

## Testing

- **Runner:** Vitest.
- **Command:** `npm run test`.
- **Environment:** `jsdom`.

## Key Files

- `src/jsx/main.jsx`: Entry point and router definition.
- `src/jsx/pages/app.jsx`: Main application layout and global state (theme, language).
- `src/jsx/library/base.jsx`: Core utilities, API wrappers, and auth logic.
