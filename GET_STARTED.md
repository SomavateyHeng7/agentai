# AgentFlow Quick Start

## Prerequisites

- Node.js 20+
- npm 10+
- Docker Desktop (optional)
- Anthropic API key

## 1. Install Dependencies

```bash
npm install
npm --prefix ui/web install
```

## 2. Configure Environment

```bash
cp .env.example .env
```

Update `ANTHROPIC_API_KEY` in `.env`.

## 3. Start in Development

```bash
npm run dev
npm run dev:ui
```

UI: `http://localhost:3001`
API: `http://localhost:3000`

## 4. Test Health Endpoint

```bash
curl http://localhost:3000/health
```

## 5. Run a Sales Qualification Request

```bash
curl -X POST http://localhost:3000/api/agents/sales/qualify \
  -H "Content-Type: application/json" \
  -d '{
    "email": "cto@example.com",
    "company": "Acme Corp",
    "message": "We need AI automation for support and have budget approved.",
    "source": "website"
  }'
```

## Optional Docker Stack

```bash
docker-compose up -d
```

Services:
- App: `http://localhost:3000`
- Prometheus: `http://localhost:9090`
- Grafana: `http://localhost:3001` (admin/admin)
