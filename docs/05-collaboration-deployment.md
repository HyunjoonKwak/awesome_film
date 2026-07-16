# Production collaboration deployment

The browser client permits unauthenticated WebSocket collaboration only on
loopback hosts. A remote `wss://` relay requires a short-lived, room-bound
ticket from an authenticated HTTP endpoint.

## Client configuration

```dotenv
NEXT_PUBLIC_COLLAB_WS_URL=wss://collab.example.com
NEXT_PUBLIC_COLLAB_TICKET_URL=https://app.example.com/api/collab-ticket
```

When a user joins a room, the editor sends this request with normal browser
credentials:

```http
POST /api/collab-ticket
Content-Type: application/json

{"room":"cut-editor:cut-..."}
```

The endpoint must authenticate and authorize the current user, then respond
with `{ "token": "..." }`. It should mint a ticket with `signCollabTicket`
from `apps/web/scripts/collab-auth.mjs`; expiry must be no more than five
minutes in the future. The HMAC secret is server-only and must never use a
`NEXT_PUBLIC_` variable.

## Relay

Run the included hardened relay behind a TLS-terminating reverse proxy:

```bash
HOST=127.0.0.1 \
PORT=32120 \
COLLAB_HMAC_SECRET='at-least-32-random-characters' \
COLLAB_ALLOWED_ORIGINS='https://app.example.com' \
pnpm --filter @cut/web collab:relay
```

The relay verifies the ticket signature, room, and expiry using a timing-safe
comparison. It also enforces an Origin allowlist, an 8 MiB WebSocket payload
limit, total connection limit, per-IP connection rate, and per-socket message
rate. Limits can be tuned with:

- `COLLAB_MAX_CONNECTIONS`
- `COLLAB_MAX_PAYLOAD_BYTES`
- `COLLAB_MAX_CONNECTS_PER_MINUTE`
- `COLLAB_MAX_MESSAGES_PER_10_SECONDS`
- `COLLAB_TRUST_PROXY=1` only behind a proxy that overwrites
  `X-Forwarded-For`

The included `e2e-collab-server.mjs` remains intentionally local-only and is
used solely by Playwright. Do not expose it to the network.
