# SpendFlow — Podman deployment

Run the full stack (PostgreSQL, API, UI) on your LAN and expose HTTPS on **stockpulse.win** via Cloudflare Tunnel.

## Quick start

```bash
# 1. Deployment URLs and bind address
cp containers/deploy.env.example containers/deploy.env
# Edit SPENDFLOW_HOST=192.168.68.100 and public URLs if needed

# 2. Secrets (Plaid, JWT, Google)
cp containers/env.example containers/.env
# Or symlink: ln -sf ../.env containers/.env

# 3. Build and start
./scripts/podman/deploy.sh
```

**LAN (Wi‑Fi / same subnet)**

| Service | URL |
|---------|-----|
| UI | http://192.168.68.100:3000 |
| API | http://192.168.68.100:4000/api/v1 |

**Internet (after Cloudflare tunnel + DNS)**

| Service | Hostname |
|---------|----------|
| UI | https://spendflow.stockpulse.win |
| API | https://spendflow-api.stockpulse.win/api/v1 |

The UI image is built with `NEXT_PUBLIC_API_URL` pointing at the **public API** so the iPhone app and browsers off-LAN use HTTPS. LAN users hit the same API URL once the tunnel is up.

## Scripts

| Script | Purpose |
|--------|---------|
| `./scripts/podman/dev.sh` | **Local dev** — Postgres container + API/UI on host with logs |
| `./scripts/podman/dev-down.sh` | Stop dev API/UI (and Postgres unless `--keep-db`) |
| `./scripts/podman/dev-logs.sh` | Follow `logs/dev/*.log` or Postgres container logs |
| `./scripts/podman/deploy.sh` | **Production-style** — build + full stack in containers |
| `./scripts/podman/build.sh` | Build API (Node) + UI (static `out/` in **nginx:alpine**) |
| `./scripts/podman/deploy.sh --no-build` | Restart without rebuild |
| `./scripts/podman/down.sh` | Stop and remove containers |
| `./scripts/podman/logs.sh` | Follow compose logs (container stack) |

### Local development (recommended for day-to-day coding)

Postgres runs in Podman; API and UI run with `npm run dev` on your machine so logs are easy to read.

```bash
# One-time: secrets in containers/.env (from env.example)
cp containers/env.example containers/.env

# Start Postgres + API + UI, then stream logs (Ctrl+C stops tail only)
./scripts/podman/dev.sh

# Or start in background
./scripts/podman/dev.sh --detach
./scripts/podman/dev-logs.sh

# Stop everything
./scripts/podman/dev-down.sh
```

| Service | Dev URL |
|---------|---------|
| UI | http://localhost:3002 |
| API | http://localhost:4000/api/v1/health |
| Postgres | `127.0.0.1:5433` (user/db from `containers/.env`) |

Log files: `logs/dev/api.log`, `logs/dev/ui.log`.

## Cloudflare Tunnel (existing `cloudflared` pod)

**Do not** add `cloudflared` to SpendFlow compose. Use your running pod (`tunnel --no-autoupdate run --token …`).

StockPulse **Kong** stays on **port 8000** (`stockpulse-kong`). Keep that public hostname (e.g. `dev.stockpulse.win` → `http://192.168.68.100:8000`). Add **new** hostnames for SpendFlow only.

### Token mode (your setup) — Zero Trust dashboard

With `--token`, ingress is configured in Cloudflare, not in a local file:

1. [Zero Trust](https://one.dash.cloudflare.com/) → **Networks** → **Tunnels** → your tunnel → **Public Hostname**.
2. Add:

| Hostname | Upstream URL |
|----------|----------------|
| `spendflow.stockpulse.win` | `http://192.168.68.100:3000` |
| `spendflow-api.stockpulse.win` | `http://192.168.68.100:4000` |

3. Leave the existing Kong route on `http://192.168.68.100:8000` unchanged.
4. The `cloudflared` pod usually picks up new routes within ~1 minute (no restart required).

Use **host IP + published ports** from `deploy.env`, not Podman names (`ui` / `api`).

### Config-file mode (optional)

If you migrate off `--token`, list Kong and SpendFlow in one `ingress:` — see `containers/cloudflared/config.yml.example`.

Set `SPENDFLOW_BUILD_TARGET=public` in `deploy.env` before `build.sh` so the UI uses `https://spendflow-api.stockpulse.win/api/v1`.

## Google Sign-In & Plaid

Add these to your Google OAuth client (**Authorized JavaScript origins**):

- `https://spendflow.stockpulse.win`
- `http://192.168.68.100:3000`

**Plaid** redirect URI (in Plaid Dashboard):

- `https://spendflow.stockpulse.win/plaid/oauth`

Set `PLAID_REDIRECT_URI` and `CORS_ORIGINS` in `containers/.env` / `deploy.env` to match.

## iOS app

Point the app API base URL at:

```text
https://spendflow-api.stockpulse.win/api/v1
```

Use the same Google OAuth **iOS** client or Web client ID as configured in backend `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_IDS`.

## Firewall

Allow inbound on the host (if you rely on LAN access without tunnel):

- TCP `3000` (UI)
- TCP `4000` (API)

Postgres is bound to `127.0.0.1:5433` only (not exposed on LAN).

## Troubleshooting

### Plaid fails with `ENCRYPTION_KEY is required in production`

The API container runs with `NODE_ENV=production`. An empty `ENCRYPTION_KEY=` in `containers/.env` breaks Plaid Link exchange and sync.

1. Generate a stable secret (keep the same value across redeploys):

   ```bash
   openssl rand -hex 32
   ```

2. Set it in `containers/.env`:

   ```text
   ENCRYPTION_KEY=<paste-the-value>
   ```

3. Restart: `./scripts/podman/deploy.sh --no-build`

`./scripts/podman/deploy.sh` also auto-generates `ENCRYPTION_KEY` when the line is missing or empty (see `spendflow_ensure_encryption_key` in `scripts/podman/lib.sh`).

If you previously linked banks in **local dev** without `ENCRYPTION_KEY`, tokens were encrypted with the dev default. Use the same key in production or disconnect and re-link Plaid items:

```text
ENCRYPTION_KEY=dev-insecure-plaid-key-change-in-production
```

```bash
./scripts/podman/logs.sh api
curl -s "http://192.168.68.100:4000/api/v1/health" | jq .
podman exec -it spendflow-postgres psql -U spendflow -d spendflow -c '\dt'
```

Rebuild UI after changing public URLs:

```bash
./scripts/podman/build.sh && ./scripts/podman/deploy.sh --no-build
```
