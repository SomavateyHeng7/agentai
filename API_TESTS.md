# AgentFlow API Test Reference

Base URL: `http://localhost:3000`  
All agent endpoints run in mock mode when `OPENAI_API_KEY` is unset (no real API calls needed for testing).

---

## Table of Contents

1. [Health & Root](#1-health--root)
2. [Agent — Sales Qualify](#2-agent--sales-qualify)
3. [Agent — Sales Orchestrate](#3-agent--sales-orchestrate)
4. [Agent — Support Triage](#4-agent--support-triage)
5. [Agent — Content Generate](#5-agent--content-generate)
6. [Workflows](#6-workflows)
7. [A/B Tests](#7-ab-tests)
8. [Monitoring](#8-monitoring)
9. [Settings](#9-settings)
10. [Dashboard & Metrics](#10-dashboard--metrics)
11. [Response Shape Reference](#11-response-shape-reference)
12. [Error Cases](#12-error-cases)

---

## 1. Health & Root

### `GET /`
Returns all available endpoints.

```bash
curl http://localhost:3000/
```

**Expected 200:**
```json
{
  "name": "AgentFlow API",
  "version": "1.0.0",
  "endpoints": ["GET /health", "POST /api/agents/sales/qualify", "..."]
}
```

---

### `GET /health`
System health check. Returns `200` when all services are up, `503` when degraded.

```bash
curl http://localhost:3000/health
```

**Expected 200 (mock mode):**
```json
{
  "status": "ok",
  "timestamp": "2026-05-01T00:00:00.000Z",
  "uptime": 42.3,
  "version": "1.0.0",
  "services": {
    "database": "ok",
    "salesforce": "mock",
    "zendesk": "mock",
    "anthropic": "ok"
  }
}
```

**Expected 503 (missing API key, live mode):**
```json
{
  "status": "degraded",
  "services": { "anthropic": "error", "..." : "..." }
}
```

**What to assert:**
- `status` is `"ok"` or `"degraded"` (never anything else)
- HTTP status matches: `200` → `"ok"`, `503` → `"degraded"`
- `uptime` is a positive number
- `services` object contains exactly: `database`, `salesforce`, `zendesk`, `anthropic`

---

## 2. Agent — Sales Qualify

### `POST /api/agents/sales/qualify`

Qualifies a B2B sales lead. Returns a score (0–100), tier, confidence, and reasoning.

#### Happy path — HOT lead

```bash
curl -X POST http://localhost:3000/api/agents/sales/qualify \
  -H "Content-Type: application/json" \
  -d '{
    "email": "cto@acme.com",
    "company": "Acme Corp",
    "source": "website",
    "message": "Budget approved by CFO, need 50 seats by end of month, I sign the contracts."
  }'
```

**Expected 200:**
```json
{
  "success": true,
  "data": {
    "score": 88,
    "tier": "HOT",
    "confidence": "HIGH",
    "reasoning": "Budget: confirmed — budget signal detected. ...",
    "nextAction": "Create Salesforce lead and auto-schedule discovery call.",
    "keyInsights": ["Budget intent detected in lead message.", "Urgency/timeline intent detected."],
    "estimatedDealSize": "$60k-$120k ARR"
  },
  "meta": {
    "durationMs": 120,
    "tokensUsed": 0,
    "retryCount": 0,
    "agentVersion": "sales-qualifier/v1"
  }
}
```

**What to assert:**
- HTTP `200`
- `success: true`
- `data.score` is integer between 80–100
- `data.tier === "HOT"`
- `data.confidence` is one of `"HIGH"`, `"MEDIUM"`, `"LOW"`
- `data.reasoning` is a non-empty string containing BANT breakdown
- `data.nextAction` is non-empty
- `meta.durationMs` is a non-negative number

---

#### WARM lead — budget present, no urgency

```bash
curl -X POST http://localhost:3000/api/agents/sales/qualify \
  -H "Content-Type: application/json" \
  -d '{
    "email": "pm@startup.io",
    "company": "Startup IO",
    "source": "referral",
    "message": "We have budget approved but our CEO needs to sign off. No rush, exploring options."
  }'
```

**Expected 200:**
```json
{
  "success": true,
  "data": {
    "score": 76,
    "tier": "WARM",
    "confidence": "MEDIUM",
    ...
  }
}
```

**What to assert:**
- `data.score` is 60–79
- `data.tier === "WARM"`

---

#### COLD lead — vague interest

```bash
curl -X POST http://localhost:3000/api/agents/sales/qualify \
  -H "Content-Type: application/json" \
  -d '{
    "email": "someone@example.com",
    "company": "Example Co",
    "source": "cold-outreach",
    "message": "Just browsing, no plans to buy this year."
  }'
```

**Expected 200:**
```json
{
  "success": true,
  "data": {
    "score": 55,
    "tier": "COLD",
    "confidence": "LOW",
    ...
  }
}
```

---

#### Negation test — "no budget" must NOT score as budget present

```bash
curl -X POST http://localhost:3000/api/agents/sales/qualify \
  -H "Content-Type: application/json" \
  -d '{
    "email": "buyer@test.com",
    "company": "Test Co",
    "source": "website",
    "message": "We don'\''t have budget right now and no urgent timeline. Just exploring."
  }'
```

**What to assert:**
- `data.tier` is `"COLD"` or `"UNQUALIFIED"` — NOT `"HOT"` or `"WARM"`
- `data.score` is below 60

---

#### Validation error — missing required fields

```bash
curl -X POST http://localhost:3000/api/agents/sales/qualify \
  -H "Content-Type: application/json" \
  -d '{
    "email": "not-an-email",
    "company": "",
    "source": "website",
    "message": "hi"
  }'
```

**Expected 400:**
```json
{
  "success": false,
  "error": "Invalid email address"
}
```

**What to assert:**
- HTTP `400`
- `success: false`
- `error` is a non-empty string describing what failed

---

#### Validation error — empty body

```bash
curl -X POST http://localhost:3000/api/agents/sales/qualify \
  -H "Content-Type: application/json" \
  -d '{}'
```

**Expected 400:**
```json
{ "success": false, "error": "..." }
```

---

## 3. Agent — Sales Orchestrate

### `POST /api/agents/sales/orchestrate`

Runs the full sales orchestration pipeline (qualify → CRM → meeting scheduling).

```bash
curl -X POST http://localhost:3000/api/agents/sales/orchestrate \
  -H "Content-Type: application/json" \
  -d '{
    "email": "vp@bigco.com",
    "company": "BigCo",
    "source": "linkedin",
    "message": "Enterprise deal, $500k budget, need to close this quarter, I run procurement."
  }'
```

**Expected 200:**
```json
{
  "success": true,
  "data": {
    "qualification": {
      "score": 88,
      "tier": "HOT",
      "confidence": "HIGH",
      ...
    },
    "workflow": "hot-lead",
    "actions": ["salesforce_created", "meeting_scheduled"]
  },
  "meta": { "durationMs": 250, "tokensUsed": 0, "retryCount": 0, "agentVersion": "..." }
}
```

**What to assert:**
- HTTP `200`
- `success: true`
- `data.qualification.tier` is a valid tier value
- `meta` object is present

---

#### Validation error

```bash
curl -X POST http://localhost:3000/api/agents/sales/orchestrate \
  -H "Content-Type: application/json" \
  -d '{ "email": "bad", "company": "X", "source": "website", "message": "short" }'
```

**Expected 400:** `success: false` with error message.

---

## 4. Agent — Support Triage

### `POST /api/agents/support/triage`

Triages an inbound support ticket. Returns priority, team routing, auto-response, and tags.

#### CRITICAL — production outage

```bash
curl -X POST http://localhost:3000/api/agents/support/triage \
  -H "Content-Type: application/json" \
  -d '{
    "id": "TKT-001",
    "subject": "Everything is down",
    "customerEmail": "admin@customer.com",
    "message": "Our entire platform is experiencing an outage. Production is down for all users."
  }'
```

**Expected 200:**
```json
{
  "success": true,
  "data": {
    "priority": "CRITICAL",
    "team": "ENGINEERING",
    "summary": "...",
    "autoResponse": "...",
    "shouldAutoRespond": false,
    "estimatedResolutionTime": "1-2 hours",
    "tags": ["technical", "priority-high"]
  }
}
```

**What to assert:**
- `data.priority === "CRITICAL"`
- `data.team === "ENGINEERING"`
- `data.shouldAutoRespond === false` (CRITICAL never auto-responds)

---

#### HIGH — login broken after password reset

```bash
curl -X POST http://localhost:3000/api/agents/support/triage \
  -H "Content-Type: application/json" \
  -d '{
    "id": "TKT-002",
    "subject": "Cannot log in",
    "customerEmail": "user@example.com",
    "message": "I reset my password but still cannot log in. The system keeps saying invalid credentials."
  }'
```

**Expected 200:**
```json
{
  "success": true,
  "data": {
    "priority": "HIGH",
    "team": "ENGINEERING",
    "shouldAutoRespond": false,
    ...
  }
}
```

---

#### HIGH — billing dispute

```bash
curl -X POST http://localhost:3000/api/agents/support/triage \
  -H "Content-Type: application/json" \
  -d '{
    "id": "TKT-003",
    "subject": "Double charge on invoice",
    "customerEmail": "billing@company.com",
    "message": "I was charged twice this month. Please investigate and issue a refund."
  }'
```

**What to assert:**
- `data.priority === "HIGH"`
- `data.team === "BILLING"`
- `data.shouldAutoRespond === false`

---

#### LOW — how-to question

```bash
curl -X POST http://localhost:3000/api/agents/support/triage \
  -H "Content-Type: application/json" \
  -d '{
    "id": "TKT-004",
    "subject": "How to export CSV",
    "customerEmail": "user@example.com",
    "message": "How do I export my data to CSV? I cannot find the option in the settings."
  }'
```

**What to assert:**
- `data.priority === "LOW"`
- `data.team === "GENERAL"`
- `data.shouldAutoRespond === true`

---

#### LOW — upgrade/sales signal

```bash
curl -X POST http://localhost:3000/api/agents/support/triage \
  -H "Content-Type: application/json" \
  -d '{
    "id": "TKT-005",
    "subject": "Enterprise pricing",
    "customerEmail": "cto@bigco.com",
    "message": "We want to upgrade to enterprise. What is the pricing for 100 seats?"
  }'
```

**What to assert:**
- `data.team === "SALES"`
- `data.priority === "LOW"`

---

#### Casual language — must not under-triage

```bash
curl -X POST http://localhost:3000/api/agents/support/triage \
  -H "Content-Type: application/json" \
  -d '{
    "id": "TKT-006",
    "subject": "help",
    "customerEmail": "angry@user.com",
    "message": "yo cant log in wtf, tried resetting my password twice its still broken"
  }'
```

**What to assert:**
- `data.priority === "HIGH"` — casual tone must not downgrade to LOW/MEDIUM
- `data.team === "ENGINEERING"`

---

#### Validation error — missing required fields

```bash
curl -X POST http://localhost:3000/api/agents/support/triage \
  -H "Content-Type: application/json" \
  -d '{
    "id": "",
    "subject": "",
    "customerEmail": "not-an-email",
    "message": "hi"
  }'
```

**Expected 400:** `success: false`

---

## 5. Agent — Content Generate

### `POST /api/agents/content/generate`

Generates a blog post, email, or social content.

#### Blog post

```bash
curl -X POST http://localhost:3000/api/agents/content/generate \
  -H "Content-Type: application/json" \
  -d '{
    "type": "blog",
    "topic": "AI automation for sales teams",
    "targetAudience": "B2B sales leaders at mid-market companies",
    "tone": "professional",
    "keywords": ["AI automation", "sales productivity", "CRM integration"],
    "wordCount": 800,
    "includeCallToAction": true
  }'
```

**Expected 200:**
```json
{
  "success": true,
  "data": {
    "title": "How AI automation accelerates modern teams",
    "content": "...",
    "excerpt": "...",
    "seoKeywords": ["agentic workflows", "automation", "ai operations"],
    "estimatedReadTime": "3 min",
    "wordCount": 120,
    "metaDescription": "...",
    "hashtags": ["#AI", "#Automation", "#DeveloperTools"],
    "callToAction": "..."
  }
}
```

**What to assert:**
- `data.wordCount` is a positive integer
- `data.estimatedReadTime` is a non-empty string
- `data.seoKeywords` is a non-empty array
- `data.title` and `data.content` are non-empty strings

---

#### Validation error — invalid content type

```bash
curl -X POST http://localhost:3000/api/agents/content/generate \
  -H "Content-Type: application/json" \
  -d '{
    "type": "podcast",
    "topic": "AI",
    "targetAudience": "developers",
    "tone": "casual",
    "keywords": ["AI"]
  }'
```

**Expected 400:** `success: false`

---

#### Validation error — too few keywords

```bash
curl -X POST http://localhost:3000/api/agents/content/generate \
  -H "Content-Type: application/json" \
  -d '{
    "type": "blog",
    "topic": "AI",
    "targetAudience": "developers",
    "tone": "casual",
    "keywords": []
  }'
```

**Expected 400:** At least one keyword required.

---

## 6. Workflows

### `POST /api/workflows/execute`

Starts an async smart lead workflow. Returns immediately with an `executionId`.

```bash
curl -X POST http://localhost:3000/api/workflows/execute \
  -H "Content-Type: application/json" \
  -d '{
    "email": "lead@enterprise.com",
    "company": "Enterprise Co",
    "source": "website",
    "message": "We have budget approved and need this by Q2."
  }'
```

**Expected 202:**
```json
{
  "success": true,
  "data": {
    "executionId": "exec_abc123",
    "status": "running",
    "startedAt": "2026-05-01T00:00:00.000Z"
  },
  "streamUrl": "/api/workflows/stream/exec_abc123"
}
```

**What to assert:**
- HTTP `202` (Accepted, not 200 — it's async)
- `data.executionId` is a non-empty string
- `streamUrl` follows the pattern `/api/workflows/stream/<id>`

---

### `GET /api/workflows/executions`

Returns all workflow executions in memory.

```bash
curl http://localhost:3000/api/workflows/executions
```

**Expected 200:**
```json
{
  "success": true,
  "data": [
    {
      "executionId": "exec_abc123",
      "status": "completed",
      "startedAt": "...",
      "completedAt": "..."
    }
  ]
}
```

---

### `GET /api/workflows/executions/:executionId`

Fetches a specific execution by ID.

```bash
curl http://localhost:3000/api/workflows/executions/exec_abc123
```

**Expected 200:** Single execution object.

**Expected 404 (unknown ID):**
```json
{ "success": false, "error": "Workflow execution not found." }
```

---

### `GET /api/workflows/metrics/paths`

Returns path distribution metrics for workflow routing.

```bash
curl http://localhost:3000/api/workflows/metrics/paths
```

**Expected 200:**
```json
{
  "success": true,
  "data": {
    "hot-lead": { "count": 5, "avgDurationMs": 240 },
    "warm-lead": { "count": 3, "avgDurationMs": 180 },
    "cold-lead": { "count": 2, "avgDurationMs": 90 }
  }
}
```

---

### `GET /api/workflows/stream/:executionId` (SSE)

Server-Sent Events stream for a live workflow execution.

```bash
curl -N http://localhost:3000/api/workflows/stream/exec_abc123
```

**Expected:** `text/event-stream` response with `data: {...}` lines.

**Expected 404-style SSE (unknown ID):**
```
data: {"success":false,"error":"Workflow execution not found."}
```

**What to assert:**
- `Content-Type: text/event-stream`
- Each SSE line starts with `data: `
- Connection closes once `status !== "running"`

---

## 7. A/B Tests

### `POST /api/ab-tests`

Starts a new A/B test comparing two prompt versions.

```bash
curl -X POST http://localhost:3000/api/ab-tests \
  -H "Content-Type: application/json" \
  -d '{
    "agentName": "sales-qualifier",
    "versionA": "v1",
    "versionB": "v2",
    "sampleSize": 20
  }'
```

**Expected 202:**
```json
{
  "success": true,
  "data": {
    "testId": "ab_xyz789",
    "status": "running",
    "agentName": "sales-qualifier",
    "versionA": "v1",
    "versionB": "v2"
  }
}
```

---

### `GET /api/ab-tests`

Lists all A/B tests.

```bash
curl http://localhost:3000/api/ab-tests
```

**Expected 200:** Array under `data`.

---

### `GET /api/ab-tests/:testId`

Fetches a test and its execution log.

```bash
curl http://localhost:3000/api/ab-tests/ab_xyz789
```

**Expected 200:**
```json
{
  "success": true,
  "data": {
    "test": { "testId": "ab_xyz789", "status": "completed", "..." : "..." },
    "executions": [...]
  }
}
```

**Expected 404:**
```json
{ "success": false, "error": "A/B test not found." }
```

---

### `POST /api/ab-tests/:testId/promote`

Promotes the winning variant.

```bash
curl -X POST http://localhost:3000/api/ab-tests/ab_xyz789/promote \
  -H "Content-Type: application/json" \
  -d '{ "winner": "B" }'
```

**Expected 200:** Updated test object with `winner: "B"`.

**Expected 400 (invalid winner value):**
```bash
curl -X POST http://localhost:3000/api/ab-tests/ab_xyz789/promote \
  -H "Content-Type: application/json" \
  -d '{ "winner": "C" }'
```
```json
{ "success": false, "error": "winner must be 'A' or 'B'." }
```

---

## 8. Monitoring

### `GET /api/monitoring/resources`

Returns memory, CPU, uptime, and recent errors.

```bash
curl http://localhost:3000/api/monitoring/resources
```

**Expected 200:**
```json
{
  "success": true,
  "data": {
    "memory": { "rss": 45000000, "heapUsed": 20000000, "heapTotal": 30000000 },
    "cpuLoad": [0.5, 0.4, 0.3],
    "uptime": 120.4,
    "recentErrors": []
  }
}
```

**What to assert:**
- `data.memory.heapUsed` is a positive number
- `data.cpuLoad` is an array of 3 numbers (1m, 5m, 15m averages)
- `data.uptime` is a positive number

---

### `GET /api/monitoring/alerts`

Returns configured alert rules.

```bash
curl http://localhost:3000/api/monitoring/alerts
```

**Expected 200:**
```json
{
  "success": true,
  "data": [
    { "id": "latency-spike", "name": "Latency Spike", "enabled": true, "threshold": 2500, "metric": "latencyMs" },
    { "id": "error-rate", "name": "Error Rate", "enabled": true, "threshold": 5, "metric": "errorRate" }
  ]
}
```

---

### `PUT /api/monitoring/alerts/:id`

Updates an alert rule's `enabled` flag or `threshold`.

```bash
curl -X PUT http://localhost:3000/api/monitoring/alerts/latency-spike \
  -H "Content-Type: application/json" \
  -d '{ "enabled": false, "threshold": 3000 }'
```

**Expected 200:** Updated alert rule.

**Expected 404 (unknown alert ID):**
```json
{ "success": false, "error": "Alert rule not found." }
```

---

### `GET /api/monitoring/webhooks`

Returns configured webhook integrations.

```bash
curl http://localhost:3000/api/monitoring/webhooks
```

**Expected 200:**
```json
{
  "success": true,
  "data": [
    { "id": "slack-default", "target": "slack", "enabled": false, "url": "" }
  ]
}
```

---

## 9. Settings

### `GET /api/settings`

Returns current application settings (API keys are masked).

```bash
curl http://localhost:3000/api/settings
```

**Expected 200:**
```json
{
  "success": true,
  "data": {
    "apiKeys": { "anthropic": "not-configured" },
    "integrations": {
      "salesforceInstanceUrl": "https://mock.salesforce.com",
      "zendeskSubdomain": "mock-company",
      "meetingBaseUrl": "https://mock-meetings.example.com"
    },
    "notifications": { "email": true, "slack": true },
    "deployment": { "defaultEnv": "staging" },
    "database": { "url": "in-memory" }
  }
}
```

**What to assert:**
- `data.apiKeys.anthropic` is either `"***configured***"` or `"not-configured"` — never the raw key

---

### `PUT /api/settings`

Updates notifications, deployment env, or integration URLs.

```bash
curl -X PUT http://localhost:3000/api/settings \
  -H "Content-Type: application/json" \
  -d '{
    "notifications": { "slack": false },
    "deployment": { "defaultEnv": "production" }
  }'
```

**Expected 200:** Full settings object with changes applied.

**What to assert:**
- `data.notifications.slack === false`
- `data.deployment.defaultEnv === "production"`
- Fields not in the request body are unchanged

---

## 10. Dashboard & Metrics

### `GET /api/dashboard`

Returns aggregated stats across all agents.

```bash
curl http://localhost:3000/api/dashboard
```

**Expected 200:**
```json
{
  "success": true,
  "data": {
    "overall": {
      "totalExecutions": 10,
      "successRate": 0.9,
      "avgDurationMs": 180
    },
    "byAgent": {
      "sales-qualifier": { "totalExecutions": 4, "successRate": 1.0 },
      "support-triage": { "totalExecutions": 3, "successRate": 0.9 }
    }
  }
}
```

---

### `GET /api/metrics/:agentName`

Returns metrics for a specific agent.

Valid `agentName` values: `sales-qualifier`, `sales-orchestrator`, `support-triage`, `content-generator`

```bash
curl http://localhost:3000/api/metrics/sales-qualifier
```

**Expected 200:**
```json
{
  "success": true,
  "data": {
    "agentName": "sales-qualifier",
    "stats": {
      "totalExecutions": 4,
      "successRate": 1.0,
      "avgDurationMs": 150,
      "avgTokensUsed": 0,
      "avgRetryCount": 0,
      "validationPassRate": 1.0
    },
    "records": [...]
  }
}
```

---

### `GET /metrics`

Prometheus-format metrics for scraping.

```bash
curl http://localhost:3000/metrics
```

**Expected 200:** Plain text in Prometheus exposition format.

---

## 11. Response Shape Reference

All endpoints follow this envelope:

| Field | Type | When present |
|-------|------|-------------|
| `success` | `boolean` | Always |
| `data` | `object \| array` | On success |
| `error` | `string` | On failure |
| `meta` | `object` | Agent endpoints only |
| `meta.durationMs` | `number` | Agent endpoints |
| `meta.tokensUsed` | `number` | Agent endpoints |
| `meta.retryCount` | `number` | Agent endpoints |
| `meta.agentVersion` | `string` | Agent endpoints |

**Score/tier consistency rules (enforced by schema):**

| Tier | Score range | Confidence |
|------|-------------|------------|
| `HOT` | 80–100 | Typically `HIGH` |
| `WARM` | 60–79 | Typically `MEDIUM` |
| `COLD` | 40–59 | Typically `LOW` |
| `UNQUALIFIED` | 0–39 | `HIGH` or `LOW` |

A result with `tier: "WARM"` and `score: 45` is a schema violation and will never be returned.

---

## 12. Error Cases

### Common 400 triggers

| Endpoint | Trigger | Error message |
|----------|---------|---------------|
| `POST /api/agents/sales/qualify` | Invalid email | `"Invalid email address"` |
| `POST /api/agents/sales/qualify` | `company: ""` | `"Company name is required"` |
| `POST /api/agents/sales/qualify` | `message` < 10 chars | `"Message must be at least 10 characters"` |
| `POST /api/agents/sales/qualify` | Unknown `source` | Zod enum error |
| `POST /api/agents/support/triage` | Missing `id` | `"Ticket ID is required"` |
| `POST /api/agents/support/triage` | Invalid `customerEmail` | `"Invalid customer email"` |
| `POST /api/agents/content/generate` | Unknown `type` | Zod enum error |
| `POST /api/agents/content/generate` | `keywords: []` | `"At least one keyword required"` |
| `POST /api/ab-tests/:id/promote` | `winner: "C"` | `"winner must be 'A' or 'B'."` |
| `PUT /api/monitoring/alerts/:id` | Unknown alert id | `"Alert rule not found."` |

### 404 triggers

| Endpoint | Trigger |
|----------|---------|
| `GET /api/workflows/executions/:id` | Unknown execution ID |
| `GET /api/workflows/stream/:id` | Unknown execution ID (SSE) |
| `GET /api/ab-tests/:testId` | Unknown test ID |
| `POST /api/ab-tests/:testId/promote` | Unknown test ID |

### 500 — unhandled server errors

Any uncaught exception returns:
```json
{ "success": false, "error": "<error message>" }
```

HTTP status `500`. The global error handler in `src/index.ts` guarantees this shape.
