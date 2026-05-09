# AgentFlow — System Flow & File Guide

This document explains what every file does and how the entire system connects, so you can understand the full picture at a glance.

---

## How the System Works (Big Picture)

```
User sends a request (API / CLI / Dashboard)
        |
        v
  [Express Server]  (src/index.ts)
        |
        v
  [Agent]  (src/mastra/agents/)
    - Validates input using Zod schemas
    - Creates a trace ID for tracking
    - Finds and runs the right workflow
        |
        v
  [Workflow]  (src/mastra/workflows/)
    - Step 1: Run a "tool" that calls Claude AI
    - Step 2: Run integration tools (Salesforce, Zendesk, etc.)
    - Step 3: Save metrics
    - Return structured result
        |
        v
  [Tools]  (src/mastra/tools/)
    - "Prompted tools" → send prompt to Claude, get JSON back
    - "Integration tools" → call external APIs (Salesforce, Zendesk)
        |
        v
  [Response] → JSON sent back to user/dashboard
```

---

## Entry Points (How requests come in)

### 1. API Server — `src/index.ts`
The main Express server. Everything starts here.

**What it does:**
- Sets up all API routes
- Connects agents to endpoints
- Runs health check
- Pushes live metrics via WebSocket every 3 seconds

**Routes → Agent mapping:**
| Route | Agent Method | What it does |
|-------|-------------|-------------|
| `POST /api/agents/sales/qualify` | `salesQualifier.qualify()` | Score a sales lead |
| `POST /api/agents/sales/orchestrate` | `salesOrchestrator.orchestrate()` | Full sales pipeline (qualify + Salesforce + meeting) |
| `POST /api/agents/support/triage` | `supportTriage.triage()` | Classify a support ticket |
| `POST /api/agents/content/generate` | `contentGenerator.generate()` | Generate marketing content |
| `GET /health` | — | System health check |
| `GET /metrics` | — | Prometheus metrics endpoint |

**Sub-routers (mounted in index.ts):**
| Router File | Mounted At | Purpose |
|------------|-----------|---------|
| `src/api/workflows.ts` | `/api/workflows` | Execute workflows, list executions, SSE streaming |
| `src/api/ab-tests.ts` | `/api/ab-tests` | Create/list/manage A/B prompt tests |
| `src/api/monitoring.ts` | `/api/monitoring` | CPU/memory stats, alert rules |
| `src/api/settings.ts` | `/api/settings` | Read/update app settings |

---

### 2. CLI — `src/cli/index.ts`
Command-line interface using the `commander` library.

**What it does:**
- Lets you run workflows from the terminal
- Scaffold new agents
- View metrics
- Run A/B tests

**Commands:**
| Command | What it does |
|---------|-------------|
| `list` | Show all registered workflows |
| `run <workflow>` | Execute a workflow with JSON input |
| `test <agent>` | Run a workflow locally for testing |
| `create-agent` | Generate boilerplate files for a new agent |
| `validate-prompts` | Check prompt files have JSON instructions |
| `metrics <agent>` | Show agent metrics (with `--live` for polling) |
| `compare-prompts` | Compare two prompt version files |
| `ab-test` | Run A/B test from config file |
| `deploy` | Deployment scaffold (stub, not real) |
| `health-check` | Hit the health endpoint |
| `ui` | Launch the dashboard dev server |

**Workflow runner:** `src/cli/workflow-runner.ts`
- Maps workflow names to actual workflow functions
- Known workflows: `sales-orchestrate`, `sales-qualify`, `support-triage`, `content-generate`

**Templates:** `cli/templates/`
- `.tpl` files used by `create-agent` command to scaffold new agent boilerplate

---

### 3. Dashboard UI — `ui/web/dashboard/`
React app for visual operations.

**Tech:** Vite + React + TypeScript + TanStack Query + Recharts + Tailwind

**Pages:**
| Route | File | What it shows |
|-------|------|-------------|
| `/` | `DashboardHomePage.tsx` | KPI cards (executions, success rate, latency, cost), trend chart, agent pie chart |
| `/agents` | `AgentsPage.tsx` | Searchable agent table with status badges |
| `/agents/:id` | `AgentDetailPage.tsx` | Tabs: overview, executions, metrics, prompts, settings |
| `/workflows` | `WorkflowsPage.tsx` | Run workflows, view executions, SSE live stream, path metrics |
| `/ab-tests` | `ABTestsPage.tsx` | Create/view A/B tests, comparison charts |
| `/playground` | `PlaygroundPage.tsx` | Interactive agent tester with JSON editor |
| `/monitoring` | `MonitoringPage.tsx` | Live WebSocket feed, CPU/memory, error logs, alert rules |
| `/settings` | `SettingsPage.tsx` | Integration URLs, notification preferences |

**API layer:**
| File | What it does |
|------|-------------|
| `src/lib/api.ts` | Axios instance + helper functions (fetchDashboard, fetchAgentMetrics, etc.) |
| `src/api/client.ts` | `AgentFlowAPI` class wrapping all API calls |

---

## Agents — The "Workers"

### How agents work

```
Input (raw JSON)
    |
    v
[BaseAgent.executeValidated()]
    |-- 1. Validate input with Zod schema
    |-- 2. Create trace ID (UUID)
    |-- 3. Get workflow from Mastra registry
    |-- 4. Execute workflow
    |-- 5. Return ApiResponse<T>
    |
    v
Output (structured JSON with meta: duration, tokens, retries)
```

### Agent files

| File | Class | Method | Workflow it runs |
|------|-------|--------|-----------------|
| `src/mastra/agents/base-agent.ts` | `BaseAgent` (abstract) | `executeValidated()` | — (shared logic) |
| `src/mastra/agents/sales-qualifier.ts` | `SalesQualifier` | `qualify()` | `sales-qualification-workflow` |
| `src/mastra/agents/sales-orchestrator.ts` | `SalesOrchestrator` | `orchestrate()` | `salesforce-meeting-orchestration-workflow` |
| `src/mastra/agents/support-triage.ts` | `SupportTriage` | `triage()` | `support-triage-workflow` |
| `src/mastra/agents/content-generator.ts` | `ContentGenerator` | `generate()` | `content-generation-workflow` |
| `src/mastra/agents/index.ts` | — | — | Re-exports all agents |

---

## Workflows — The "Pipelines"

Each workflow chains multiple steps together. Think of it as: **"do this, then do that, then save results."**

### Sales Qualification Workflow
**File:** `src/mastra/workflows/sales-qualification.workflow.ts`
```
1. Qualify lead (Claude AI scores it) ............ REQUIRED
2. Create Salesforce record ...................... OPTIONAL (won't fail workflow)
3. Schedule meeting (if HOT lead) ................ OPTIONAL (won't fail workflow)
4. Save metrics
5. Return result
```

### Salesforce + Meeting Orchestration Workflow
**File:** `src/mastra/workflows/salesforce-meeting-orchestration.workflow.ts`
```
Same as above but uses the orchestration runner for step management.
Uses: src/mastra/workflows/orchestration-runner.ts
```

### Support Triage Workflow
**File:** `src/mastra/workflows/support-triage.workflow.ts`
```
1. Triage ticket (Claude AI classifies it) ....... REQUIRED
2. Create Zendesk ticket ......................... OPTIONAL
3. Save metrics
4. Return result
```

### Content Generation Workflow
**File:** `src/mastra/workflows/content-generation.workflow.ts`
```
1. Generate content (Claude AI writes it) ........ REQUIRED
2. Save metrics
3. Return result
```

### Smart Lead Workflow (advanced)
**Files:**
- `src/mastra/workflows/smart-lead-runtime.ts` — Execution tracking, event subscriptions, SSE streaming
- `src/mastra/workflows/smart-lead/definition.ts` — Workflow definition with branching logic
- `src/mastra/workflows/smart-lead/types.ts` — TypeScript interfaces for execution state

```
1. Qualify lead
2. Branch based on tier:
   - HOT → Salesforce + Calendar + Slack notification
   - WARM → Salesforce + Email nurture
   - COLD → Log and skip
3. Track each step as audit trail
4. Emit events for SSE streaming
```

### Orchestration Runner (shared helper)
**File:** `src/mastra/workflows/orchestration-runner.ts`

Generic step runner used by orchestration workflows:
- Runs steps sequentially
- Required steps fail the whole workflow if they error
- Optional steps log the error but continue
- Steps can be conditionally skipped

---

## Tools — The "Actions"

Tools are individual units of work. Two types:

### Type 1: Claude-Prompted Tools (AI does the thinking)
These send a prompt to Claude and parse the JSON response.

| File | What it does |
|------|-------------|
| `src/mastra/tools/qualify-sales-lead.tool.ts` | Sends lead info to Claude, gets score/tier/reasoning back |
| `src/mastra/tools/triage-support-ticket.tool.ts` | Sends ticket to Claude, gets priority/team/response back |
| `src/mastra/tools/generate-content.tool.ts` | Sends content request to Claude, gets article/email/post back |

**How they work:**
```
Input + Prompt → runPromptedClaudeTool() → Claude API → Parse JSON → Validate with Zod → Return
```

### Type 2: Integration Tools (code does the work)
These call external APIs or services.

| File | What it does |
|------|-------------|
| `src/mastra/tools/create-salesforce-lead.tool.ts` | Creates a lead record in Salesforce |
| `src/mastra/tools/create-zendesk-ticket.tool.ts` | Creates a ticket in Zendesk + sends auto-response |
| `src/mastra/tools/schedule-sales-meeting.tool.ts` | Books a meeting for HOT leads |

### Tool Helpers
**File:** `src/mastra/tools/tool-helpers.ts`
- `loadPromptReference()` — Reads prompt version markdown files from disk
- `runPromptedClaudeTool()` — Sends prompt to Claude API, parses response, validates with Zod

---

## Claude AI Integration

**File:** `src/mastra/utils/claude-runner.ts`

This is the core LLM layer. Everything that talks to Claude goes through here.

**What it provides:**
| Function | What it does |
|----------|-------------|
| `getAnthropicClient()` | Creates/returns the Anthropic SDK client (singleton) |
| `getModel()` | Returns model name from `CLAUDE_MODEL` env var (default: `claude-sonnet-4-6`) |
| `runWithRetry()` | Calls Claude with 3 retries + exponential backoff (1s, 2s, 4s) |
| `extractJSON()` | Pulls JSON out of Claude's response (handles markdown code blocks) |

**Mock mode:** When `USE_MOCK_INTEGRATIONS=true` or no API key is set, it returns fake responses based on keyword matching in the input. This lets you demo without paying for API calls.

---

## Types & Schemas

**File:** `src/types/index.ts`

All input/output contracts are Zod schemas defined here.

**Input schemas (what you send):**
| Schema | Used by |
|--------|---------|
| `SalesLeadSchema` | Sales qualifier agent |
| `SupportTicketSchema` | Support triage agent |
| `ContentRequestSchema` | Content generator agent |

**Output schemas (what you get back):**
| Schema | Used by |
|--------|---------|
| `SalesQualificationResultSchema` | Sales qualifier result |
| `SupportTriageResultSchema` | Support triage result |
| `ContentResultSchema` | Content generator result |

**Internal schemas:**
| Schema | Purpose |
|--------|---------|
| `AgentMetricsSchema` | Tracks execution performance (duration, tokens, success) |
| `AggregatedStats` | Dashboard-level summary stats |
| `HealthStatus` | Health check response shape |

---

## Prompts

### Prompt functions — `src/prompts/index.ts`
Each function takes input data and returns a `PromptPack { system, user }`:

| Function | What it tells Claude |
|----------|---------------------|
| `salesQualificationPrompt()` | "You are a B2B sales AI. Score this lead 0-100 using BANT framework. Return JSON." |
| `supportTriagePrompt()` | "You are a support AI. Classify this ticket by priority and team. Return JSON." |
| `contentGenerationPrompt()` | "You are a content AI. Write a blog/email/social post about this topic. Return JSON." |

### Prompt versions — `src/prompts/versions/`
```
src/prompts/versions/
  sales-qualifier/
    v1.md .......... Version 1 prompt reference
    v2.md .......... Version 2 (for A/B testing)
  support-triage/
    v1.md
  content-generator/
    v1.md
```

These markdown files are loaded by `loadPromptReference()` and appended to the system prompt.

---

## Integrations (External Services)

All integrations follow the same adapter pattern with mock mode support.

**File:** `src/integrations/salesforce.ts`
- `SalesforceAdapter` class
- Methods: `createLead()`, `updateLead()`, `getLead()`, `convertLeadToOpportunity()`
- Mock mode: generates fake IDs like `00Qxxxxx`

**File:** `src/integrations/zendesk.ts`
- `ZendeskAdapter` class
- Methods: `createTicket()`, `updateTicket()`, `sendAutoResponse()`, `escalateTicket()`
- Mock mode: generates 6-digit ticket IDs

**File:** `src/integrations/meetings.ts`
- `MeetingsAdapter` class
- Methods: `scheduleMeeting()`
- Mock mode: schedules next business day at 15:00 UTC

**File:** `src/integrations/database.ts`
- In-memory metrics store (mock PostgreSQL)
- Methods: `saveMetrics()`, `getMetrics()`, `getAggregatedStats()`, `getDashboardStats()`

**File:** `src/mastra/store/postgres-store.ts`
- `PostgresStore` class — real PostgreSQL connection (optional)
- Uses `pg` library with connection pooling
- Only active when `DATABASE_URL` is set and `USE_MOCK_INTEGRATIONS` is not true

---

## Observability & Metrics

### Logging — `src/mastra/observability.ts`
| Function | What it does |
|----------|-------------|
| `createTraceId()` | Generates a UUID to track a request through all steps |
| `logBusinessAction()` | Structured log with stage (entry/exit/error), traceId, and metadata |

### Prometheus metrics — `src/observability/metrics.ts`
| Metric | Type | What it tracks |
|--------|------|---------------|
| `agent_execution_total` | Counter | Total executions per agent (with success/tier labels) |
| `agent_duration_seconds` | Histogram | How long each execution takes |
| `agent_tokens_used` | Histogram | Token consumption per execution |
| `agent_validation_failures_total` | Counter | Input validation failures |
| `agent_retry_total` | Counter | Claude API retries |
| `agent_error_total` | Counter | Errors by type (timeout, rate_limit, validation, etc.) |

### Framework — `src/mastra/`
| File | What it does |
|------|-------------|
| `src/mastra/index.ts` | Initializes the Mastra framework, registers all workflows |
| `src/mastra/framework.ts` | `Mastra` class — workflow registry (register + get workflows) |
| `src/mastra/constants.ts` | `AGENT_VERSION = '2.0.0-mastra'` |

---

## A/B Testing

**File:** `src/testing/ab-test.ts`
- `startABTest()` — Runs two workflow variants against same input samples
- `listABTests()`, `getABTestById()`, `promoteABTestWinner()` — Management functions

**File:** `src/testing/metrics-collector.ts`
- `aggregateVariantMetrics()` — Calculates averages for each variant
- `compareVariants()` — Statistical z-score test (95% confidence)

**Flow:**
```
Config (variant A vs variant B, N samples)
    |
    v
Run variant A with sample 1, 2, 3...
Run variant B with sample 1, 2, 3...
    |
    v
Aggregate: success rate, avg duration, avg tokens, cost
    |
    v
Compare with z-score → recommend winner
```

---

## Database Migrations

**Location:** `migrations/`

| File | Tables |
|------|--------|
| `20260331_ab_tests_schema.sql` | `ab_tests`, `ab_test_executions` |
| `20260331_add_orchestration_ab_testing_tables.sql` | `ab_test_runs`, `ab_test_cases` |

---

## Tests

**Location:** `tests/`

| File | What it tests |
|------|-------------|
| `sales-qualifier.test.ts` | Sales lead Zod schema validation + prompt structure |
| `support-triage.test.ts` | Support ticket Zod schema validation + prompt structure |
| `content-generator.test.ts` | Content request Zod schema validation + prompt structure |

All tests currently validate schemas (do inputs/outputs parse correctly?) and check prompts contain JSON instructions.

---

## Config Files

| File | Purpose |
|------|---------|
| `tsconfig.json` | TypeScript config: ES2020, commonjs, strict mode |
| `package.json` | Dependencies, scripts, Jest config |
| `docker-compose.yml` | Multi-service setup: app + postgres + prometheus + grafana |
| `Dockerfile` | Node 20 two-stage build, exposes port 3000 |
| `vercel.json` | Vercel serverless deployment config |
| `prometheus.yml` | Prometheus scrape config |
| `setup.sh` | First-time setup script |

---

## Known Issues That Need Fixing

### Critical
1. **SalesOrchestrator doesn't extend BaseAgent** — It duplicates validation/error handling logic instead of using `executeValidated()` like the other agents
2. **Dashboard hardcodes `localhost:3000`** — WebSocket in MonitoringPage and SSE in WorkflowsPage use hardcoded URLs instead of the API base URL
3. **Metrics store grows forever** — In-memory array with no size limit, will eventually crash
4. **`sales-orchestrator` missing from dashboard stats** — `database.ts` only aggregates 3 agents, not 4

### High
5. **Prompt versions are stubs** — The actual prompts live in TypeScript code, the `.md` version files are minimal — makes A/B testing less useful
6. **Settings not persisted** — Changes via dashboard are lost on restart
7. **Errors silently swallowed** — Integration failures in workflows are caught but only logged as metadata, easy to miss
8. **BaseAgent doesn't catch workflow errors** — If `workflow.run()` throws, it propagates uncaught

### Medium
9. **Mock LLM is too simple** — Uses keyword regex matching, doesn't actually test prompt quality
10. **API response format inconsistent** — Agent routes, workflow routes, and A/B routes return slightly different shapes
11. **Workflow names are strings** — No compile-time safety; typo in workflow name = runtime crash
12. **CLI metrics uses hardcoded localhost** — Won't work against remote servers
13. **Two conflicting A/B test migration files** — Both create similar tables with different schemas
14. **Prompt validation too lenient** — Only checks if file contains the word "JSON"
15. **No authentication on any endpoint** — Anyone can call any API route
16. **Live metrics mode leaks memory** — `setInterval` never cleared on exit
