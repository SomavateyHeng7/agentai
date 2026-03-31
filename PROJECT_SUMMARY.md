# AgentFlow Project Summary

## What This Project Demonstrates

- Multi-agent AI system design in TypeScript
- Prompt packs and strict schema validation with Zod
- Retry logic with exponential backoff
- Integrations via adapter pattern (Salesforce, Zendesk)
- Observability via Prometheus-compatible metrics
- Dockerized deployment and CI workflow

## Included Agents

- `sales-qualifier`: Scores leads and recommends follow-ups
- `support-triage`: Routes support tickets and drafts auto-responses
- `content-generator`: Produces marketing content for blog/email/social

## Included Endpoints

- `GET /health`
- `POST /api/agents/sales/qualify`
- `POST /api/agents/support/triage`
- `POST /api/agents/content/generate`
- `GET /api/dashboard`
- `GET /api/metrics/:agentName`
- `GET /metrics`

## Contact

- Name: Tey Heng
- Email: teyyyyyheng@users.noreply.github.com
- LinkedIn: https://linkedin.com/in/teyyyyyheng
