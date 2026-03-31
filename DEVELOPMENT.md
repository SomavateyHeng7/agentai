# Development Guide

## Prerequisites

- Node.js 20+
- npm 10+

## Install

```bash
npm install
npm --prefix ui/web install
npm --prefix ui/web/dashboard install
cp .env.example .env
```

## Backend

```bash
npm run dev
```

API base URL: `http://localhost:3000`

Start this first because both UIs call backend endpoints.

## Next.js UI (legacy app)

```bash
npm run dev:ui
```

URL: `http://localhost:3001`

## Dashboard UI (new app)

```bash
npm run dev:dashboard
```

URL: `http://localhost:5173`

Alternative direct commands (without root scripts):

```bash
npm --prefix ui/web run dev
npm --prefix ui/web/dashboard run dev
```

## Quality Gates

```bash
npm run build
npm run typecheck
npm run lint
npm test
npm run build:ui
npm run build:dashboard
```

## CLI

```bash
npm run cli -- --help
npm run cli -- list
npm run cli -- health-check --all
```

## Feature-specific APIs

- Workflows:
  - `POST /api/workflows/execute`
  - `GET /api/workflows/executions`
  - `GET /api/workflows/metrics/paths`
  - `GET /api/workflows/stream/:executionId`
- A/B testing:
  - `POST /api/ab-tests`
  - `GET /api/ab-tests`
  - `GET /api/ab-tests/:testId`
  - `POST /api/ab-tests/:testId/promote`
- Monitoring:
  - `GET /api/monitoring/resources`
  - `GET /api/monitoring/alerts`
  - `PUT /api/monitoring/alerts/:id`
- Settings:
  - `GET /api/settings`
  - `PUT /api/settings`

## Notes

- Without `ANTHROPIC_API_KEY`, LLM-backed commands still execute but return failure envelopes.
- `USE_MOCK_INTEGRATIONS=true` is recommended for local demo flow.
