# Container Deployment (Podman)

**Last Updated:** June 2026  
**Status:** Implemented — see `containers/` and `scripts/podman/`

SpendFlow deploys as **separate Podman containers** for UI and backend, plus infrastructure containers for PostgreSQL and Redis.

---

## Target topology

```
┌─────────────────────────────────────────────────────────────┐
│  podman compose (network: spendflow-net)                    │
│                                                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐        │
│  │ spendflow-ui │  │spendflow-api │  │spendflow-worker│     │
│  │   :3000      │  │   :4000      │  │  (no port)   │        │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘        │
│         │                 │                  │               │
│         │                 └────────┬─────────┘               │
│         │                          │                         │
│         │              ┌───────────▼───────────┐             │
│         │              │     postgres:16       │             │
│         │              │     redis:7           │             │
│         │              └───────────────────────┘             │
└─────────────────────────────────────────────────────────────┘
         │
    Reverse proxy (Caddy/Traefik) — optional, host-level
    ui.spendflow.local → :3000
    api.spendflow.local → :4000
```

---

## Images

| Image | Source | Base | Output |
|-------|--------|------|--------|
| `spendflow-ui` | `ui/` | `nginx:alpine` | Next.js static `export` → nginx |
| `spendflow-api` | `backend/` | `node:22-alpine` | Compiled Fastify (`dist/`) |
| `spendflow-worker` | `backend/` (same build) | same as API | `node dist/worker.js` |

Worker shares the API image with a different `CMD` — same codebase, no secrets in UI image.

---

## Planned Containerfiles

### UI (`containers/Containerfile.ui`)

- Multi-stage: deps → build → runtime
- `NEXT_PUBLIC_API_URL` as build arg
- Run as non-root user (`node`)
- Expose `3000`
- Healthcheck: `GET /api/health` (Next.js route proxy or direct)

### Backend (`containers/Containerfile.backend`)

- Multi-stage: deps → `tsc` build → runtime
- No devDependencies in final layer
- Run as non-root user
- Expose `4000`
- Healthcheck: `GET /api/v1/health`

---

## Compose services (planned)

| Service | Image | Depends on | Volumes |
|---------|-------|------------|---------|
| `postgres` | `docker.io/library/postgres:16-alpine` | — | named volume `pgdata` |
| `redis` | `docker.io/library/redis:7-alpine` | — | optional persistence |
| `api` | `spendflow-api` | postgres, redis | — |
| `worker` | `spendflow-api` | postgres, redis | — |
| `ui` | `spendflow-ui` | api | — |

Environment via `containers/.env` (gitignored) or Podman secrets.

---

## Networking

- Internal DNS: `api`, `postgres`, `redis` on `spendflow-net`
- UI calls `http://api:4000` internally; browser calls public `NEXT_PUBLIC_API_URL`
- Plaid webhook URL points to public API: `https://api.spendflow.local/api/v1/webhooks/plaid`

---

## Development vs production

| Mode | UI | API | DB |
|------|-----|-----|-----|
| Local dev | `npm run dev` :3000 | `npm run dev` :4000 | local postgres or compose |
| Podman dev | compose with hot-reload volumes (optional) | same | compose |
| Production | standalone image | compiled image | managed postgres volume |

---

## Security checklist (deployment)

- [ ] Non-root containers
- [ ] Read-only root filesystem where possible
- [ ] Secrets via Podman secrets or env files (not in image layers)
- [ ] TLS termination at reverse proxy
- [ ] CORS restricted to UI origin
- [ ] Postgres not exposed on host in production

---

## Deploy commands

```bash
cp containers/deploy.env.example containers/deploy.env
cp containers/env.example containers/.env
./scripts/podman/deploy.sh
```

See [containers/README.md](../../containers/README.md) for Cloudflare Tunnel hostnames (`spendflow.stockpulse.win`, `spendflow-api.stockpulse.win`) and LAN access at `192.168.68.100`.

## Next steps

- Add `spendflow-worker` image when BullMQ worker entry ships.
- TLS / Caddy on host is optional when using Cloudflare Tunnel.
