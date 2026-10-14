# URL Shortener API

A small REST API that shortens URLs, redirects, and tracks clicks. Built with **plain Node.js — no dependencies**.

## Run
```bash
npm start            # http://localhost:3000
npm test             # node:test integration tests
```

## Endpoints
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/links` | Body `{ "url": "https://…", "alias": "optional" }` → `201` with `code`, `shortUrl` |
| GET | `/api/links` | List all links |
| GET | `/api/links/:code` | Link details + click count |
| DELETE | `/api/links/:code` | Remove a link (`204`) |
| GET | `/:code` | `302` redirect to the target, increments clicks |

```bash
curl -X POST localhost:3000/api/links -d '{"url":"https://example.com","alias":"demo"}'
curl -i localhost:3000/demo
```

## Highlights
- Input validation (http/https only, alias format), `409` on alias collisions
- Cryptographically random codes via `crypto.randomBytes`
- Request body size limit, JSON error handling
- Integration tests spin up the real server on an ephemeral port
