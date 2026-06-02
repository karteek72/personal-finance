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
| `./scripts/podman/start.sh` | **Main entry** — same as `deploy.sh` |
| `./scripts/podman/build.sh` | Build API (Node) + UI (static `out/` in **nginx:alpine**) |
| `./scripts/podman/deploy.sh` | Build + `podman compose up -d` |
| `./scripts/podman/deploy.sh --no-build` | Restart without rebuild |
| `./scripts/podman/down.sh` | Stop and remove containers |
| `./scripts/podman/logs.sh` | Follow compose logs |

## Cloudflare Tunnel (host systemd)

**Do not** run `cloudflared` in compose — use the existing **systemd** service on this machine.

Subdomains:

- `spendflow.stockpulse.win` → UI
- `spendflow-api.stockpulse.win` → API

After `./scripts/podman/start.sh`, containers listen on `SPENDFLOW_HOST` (default `192.168.68.100`) ports **3000** and **4000**. Point tunnel ingress at those host URLs, not Docker service names:

```yaml
# /etc/cloudflared/config.yml (see containers/cloudflared/config.yml.example)
ingress:
  - hostname: spendflow.stockpulse.win
    service: http://192.168.68.100:3000
  - hostname: spendflow-api.stockpulse.win
    service: http://192.168.68.100:4000
  - service: http_status:404
```

```bash
sudo systemctl restart cloudflared
```

Set `SPENDFLOW_BUILD_TARGET=public` in `containers/deploy.env` before `./scripts/podman/build.sh` so the UI image uses the HTTPS API URL for iPhone / internet.

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

```bash
./scripts/podman/logs.sh api
curl -s "http://192.168.68.100:4000/api/v1/health" | jq .
podman exec -it spendflow-postgres psql -U spendflow -d spendflow -c '\dt'
```

Rebuild UI after changing public URLs:

```bash
./scripts/podman/build.sh && ./scripts/podman/deploy.sh --no-build
```
