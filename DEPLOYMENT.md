# Deployment Guide

## Deployment Topology

- Backend API (`src/index.ts`) on Node runtime host (Docker, VM, container app, etc.).
- Frontend:
  - `ui/web/` Next.js app (optional legacy UI)
  - `ui/web/dashboard/` Vite app (recommended ops UI)

## Docker Backend

```bash
docker-compose up -d --build
```

## Vercel Compatibility

`vercel.json` includes:

- `api/agents/**`
- `api/workflows.ts`
- `api/ab-tests.ts`

For full Express APIs (`/api/monitoring`, `/api/settings`, websocket stream), use Node-hosted backend.

## Dashboard Deployment

Build static assets:

```bash
npm --prefix ui/web/dashboard run build
```

Deploy `ui/web/dashboard/dist` to any static host (Vercel static project, Netlify, Azure Static Web Apps, etc.).

## Next.js UI Deployment (Optional)

Build and run Next.js app:

```bash
npm --prefix ui/web run build
npm --prefix ui/web run start
```

Deploy `ui/web/` as a standard Next.js app if you want to keep the legacy UI in production.

Set environment variable:

- `VITE_API_BASE_URL=https://<backend-domain>`

If deploying Next.js UI, set:

- `NEXT_PUBLIC_API_BASE_URL=https://<backend-domain>` (if used by UI configuration)

## Production Environment Variables

Required:

- `ANTHROPIC_API_KEY`
- `NODE_ENV=production`

Recommended:

- `USE_MOCK_INTEGRATIONS=false`
- `DATABASE_URL=<postgres-connection-string>`
- `SALESFORCE_INSTANCE_URL`
- `ZENDESK_SUBDOMAIN`
- `MEETING_BASE_URL`

## Health Verification

- `GET /health`
- `GET /api/dashboard`
- `GET /metrics`
- WebSocket: `ws://<host>/ws/metrics`

## Rollout Checklist

1. Build backend and dashboard.
2. Build Next.js UI if deploying it.
3. Run typecheck/lint/tests.
4. Apply migrations from `migrations/`.
5. Deploy backend.
6. Deploy dashboard with `VITE_API_BASE_URL`.
7. Validate workflows and A/B endpoints.
