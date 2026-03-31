# AgentFlow

AgentFlow is a TypeScript AI agent platform that demonstrates how to build production-style multi-agent systems: structured workflows, tool calling, A/B prompt testing, observability, and dual UI experiences.

Built for portfolio and internship showcasing, it includes both API-first architecture and operator-facing dashboards.

## Why This Project

- End-to-end agent lifecycle: input validation, workflow execution, tool orchestration, metrics, and replayable outputs.
- Real engineering patterns: strict Zod contracts, retry logic, tracing, CI/CD, migrations, and deploy-ready structure.
- Demo-friendly runtime: mock integrations and mock LLM fallback allow full flows even without external API keys.

## Feature Overview

- Sales qualification agent with scoring and next-action guidance.
- Salesforce + meeting orchestration workflow for end-to-end sales handling.
- Support triage agent with Zendesk integration hooks.
- Content generation agent for blog/email/social outputs.
- Cross-platform CLI for workflow execution and A/B testing.
- Multi-agent workflow orchestration with branch-level audit trails and SSE updates.
- React + TypeScript dashboard app (`ui/web/dashboard/`) for operations and experimentation.
- Observability via API stats and Prometheus endpoint.

## Quick Demo (60 Seconds)

```bash
npm install
npm --prefix ui/web install
npm --prefix ui/web/dashboard install
cp .env.example .env
npm run dev
```

In a second terminal:

```bash
npm run dev:ui
npm run dev:dashboard
```

Smoke test the core flow:

```bash
curl -s -X POST http://localhost:3000/api/agents/sales/qualify \
  -H 'Content-Type: application/json' \
  -d '{"email":"cto@example.com","company":"Acme Corp","message":"We need enterprise automation and have budget approved this quarter","source":"website"}'
```

## Project Structure

- `src/agents`: API-facing agent entrypoints.
- `src/mastra/workflows`: Workflow definitions, including orchestration.
- `src/mastra/tools`: Tool layer with Zod-validated contracts.
- `src/cli`: Command-line runner for workflows and experiments.
- `src/workflows`: Orchestrator, smart-lead workflow, reusable actions.
- `src/testing`: A/B testing orchestrator and statistical metrics collector.
- `src/api`: API routers for workflows and A/B tests.
- `src/integrations`: Salesforce, Zendesk, meetings, and data adapters.
- `migrations`: SQL migrations for persistent data structures.
- `examples`: Sample configs, outputs, and usage docs.
- `ui/web`: Next.js UI app.
- `ui/web/dashboard`: Vite + React + Tailwind operations dashboard.
- `cli/templates`: Agent scaffolding templates for `create-agent` command.

## Local Development

Use the command sequence in `Quick Demo (60 Seconds)` for local startup.

- Backend API: `http://localhost:3000`
- Next.js UI: `http://localhost:3001`
- Dashboard UI: `http://localhost:5173`

For first-time setup and run steps, use this section as the canonical source.

## API Endpoints

- `GET /health`
- `POST /api/agents/sales/qualify`
- `POST /api/agents/sales/orchestrate`
- `POST /api/agents/support/triage`
- `POST /api/agents/content/generate`
- `POST /api/workflows/execute`
- `GET /api/workflows/executions`
- `GET /api/workflows/executions/:executionId`
- `GET /api/workflows/metrics/paths`
- `GET /api/workflows/stream/:executionId`
- `POST /api/ab-tests`
- `GET /api/ab-tests`
- `GET /api/ab-tests/:testId`
- `GET /api/dashboard`
- `GET /api/metrics/:agentName`
- `GET /metrics`

## CLI Command Reference

Build before running CLI commands:

```bash
npm run build
```

List workflows:

```bash
npm run cli -- list
```

Create agent scaffold:

```bash
npm run cli -- create-agent --name churn-analyzer --type sales
```

Run one workflow with inline payload:

```bash
npm run cli -- run sales-orchestrate --json '{
  "email": "cto@example.com",
  "company": "Acme Corp",
  "message": "We need enterprise automation and have budget approved.",
  "source": "website"
}' --pretty
```

Run one workflow with file payload:

```bash
npm run cli -- run support-triage --input ./examples/support-ticket.sample.json --pretty
```

Run local test command:

```bash
npm run cli -- test sales-orchestrate --input ./examples/sales-lead.sample.json --pretty
```

Validate prompt packs:

```bash
npm run cli -- validate-prompts sales-qualifier
```

Deploy command scaffold:

```bash
npm run cli -- deploy sales-orchestrate --env staging
```

Show metrics:

```bash
npm run cli -- metrics sales-qualify
npm run cli -- metrics sales-qualify --live
```

Compare prompt versions:

```bash
npm run cli -- compare-prompts --agent sales-qualifier --versions v1,v2
```

Health-check all services:

```bash
npm run cli -- health-check --all
```

Launch dashboard via CLI:

```bash
npm run cli -- ui
```

Run A/B test:

```bash
npm run cli -- ab-test --input ./examples/ab-test-config.sample.json --pretty
```

## Workflow Examples

- Example orchestration definition:
  `examples/workflow-definition.example.ts`
- Example sales orchestration payload:
  `examples/sales-lead.sample.json`
- Example CLI walkthrough:
  `examples/sample-cli-usage.md`

## A/B Testing Guide

1. Create a config file with `testName`, `controlWorkflow`, `candidateWorkflow`, `samples`, and `runsPerSample`.
2. Run `npm run cli -- ab-test --input ./path/to/config.json --pretty`.
3. Compare `successRate`, `avgDurationMs`, and `avgTokensUsed` in the output summary.
4. Use `recommendation` as a decision aid, then validate with additional samples.

Example config: `examples/ab-test-config.sample.json`

Example result: `examples/ab-test-results.example.json`

Core A/B modules:

- `src/testing/ab-test.ts`
- `src/testing/metrics-collector.ts`
- `src/prompts/versions/`

## Database Migration

New SQL migration for experiment tables:

- `migrations/20260331_add_orchestration_ab_testing_tables.sql`
- `migrations/20260331_ab_tests_schema.sql`

## Dashboard UI

Run the dashboard app from root scripts:

```bash
npm run dev:dashboard
```

Routes:

- `/` home dashboard with KPI cards and trend charts
- `/agents` searchable agent table with status/actions
- `/agents/:agentId` detail tabs (overview, executions, metrics, prompts, settings)
- `/workflows` workflow execution, path metrics, and SSE stream viewer
- `/ab-tests` A/B test inventory

## Deployment Compatibility

Docker:

```bash
docker-compose up -d --build
```

Vercel + API split deployment:

- Keep the backend (`src/index.ts`) on Node runtime infrastructure.
- Deploy `ui/web/` and/or `ui/web/dashboard/` frontend(s) separately and set API base URL to backend URL.
- Core agent routes remain compatible with current `vercel.json` function settings.

## Scripts

- `npm run dev`
- `npm run dev:ui`
- `npm run build`
- `npm run build:ui`
- `npm run start`
- `npm run start:ui`
- `npm run cli -- list`
- `npm --prefix ui/web/dashboard run dev`
- `npm --prefix ui/web/dashboard run build`
- `npm run test`
- `npm run lint`

## Documentation

- `GET_STARTED.md`
- `PROJECT_SUMMARY.md`
- `docs/ARCHITECTURE.md`
- `docs/PORTFOLIO_GUIDE.md`
