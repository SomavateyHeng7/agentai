# Changes Summary

## 1. Project Structure Reorganization

Agents and workflows were moved from flat `src/agents/` and `src/workflows/` directories into a canonical `src/mastra/` namespace.

| Before | After |
|---|---|
| `src/agents/base-agent.ts` | `src/mastra/agents/base-agent.ts` |
| `src/agents/sales-qualifier.ts` | `src/mastra/agents/sales-qualifier.ts` |
| `src/agents/support-triage.ts` | `src/mastra/agents/support-triage.ts` |
| `src/agents/content-generator.ts` | `src/mastra/agents/content-generator.ts` |
| `src/agents/sales-orchestrator.ts` | `src/mastra/agents/sales-orchestrator.ts` |
| `src/workflows/orchestrator.ts` | `src/mastra/workflows/smart-lead-runtime.ts` |
| `src/workflows/smart-lead/...` | `src/mastra/workflows/smart-lead/...` |

An `src/mastra/agents/index.ts` barrel file was added to re-export all agents from a single entry point.

---

## 2. `BaseAgent` Class Introduced

`src/mastra/agents/base-agent.ts` is a new abstract base class that standardizes agent behavior:

- Accepts a Zod schema and validates input before execution.
- Creates a trace ID for observability on every run.
- Delegates execution to `mastra.getWorkflow()`, keeping agent classes thin.
- Returns a typed `ApiResponse<TResult>` with consistent error shapes.

All concrete agents (`SalesQualifier`, `SupportTriage`, `ContentGenerator`) extend this class.

---

## 3. Workflow Runtime Extracted

`src/mastra/workflows/smart-lead-runtime.ts` was extracted from the previous `orchestrator.ts`. It provides:

- `startSmartLeadWorkflow(input)` — validates and launches a Smart Lead execution.
- `getWorkflowExecution(id)` / `getWorkflowExecutions()` — retrieval helpers.
- `subscribeWorkflowExecution(id, callback)` — event-based SSE subscription.
- `getWorkflowPathMetrics()` — per-path run/success/successRate analytics.

The runtime uses an in-memory `Map` + `EventEmitter` for execution state.

---

## 4. Import Path Updates

All consumers were updated to point at the new `src/mastra/` paths:

- `src/index.ts` — now imports agents from `./mastra/agents`.
- `src/cli/workflow-runner.ts` — dynamic imports updated to `../mastra/agents/...`.
- `api/workflows.ts` (Vercel handler) — updated to import from `src/mastra/workflows/smart-lead-runtime`.
- `cli/templates/agent.template.ts.tpl` — fixed relative path to `../../types`.

---

## 5. New Dependencies Added

The following packages were added to `package.json` / `pnpm-lock.yaml`:

| Package | Purpose |
|---|---|
| `chalk ^4.1.2` | Colored terminal output for CLI |
| `commander ^12.1.0` | CLI argument parsing |
| `inquirer ^8.2.6` | Interactive CLI prompts |
| `ora ^5.4.1` | CLI spinner for async feedback |
| `ws ^8.18.0` | WebSocket client/server |
| `@types/inquirer ^9.0.7` | Types for inquirer |
| `@types/ws ^8.5.12` | Types for ws |

---

## 6. Dashboard UI — Navigation Overhaul

`ui/web/dashboard/src/App.tsx` was significantly upgraded:

- **Sticky sidebar** on desktop highlights the active route.
- **Previous / Next section** buttons added to the top bar.
- **Quick Jump panel** (`Cmd/Ctrl+K`) for keyboard-driven navigation with live search.
- **Keyboard shortcuts:**
  - `Cmd/Ctrl+K` — toggle Quick Jump
  - `Alt+Left` / `Alt+Right` — navigate between sections
  - `Esc` — close Quick Jump
  - `Enter` in search — jump to first matched section
- Mobile layout retained with compact header and horizontal tab nav.

---

## 7. Workflow Studio (`/workflows` page)

`ui/web/dashboard/src/pages/WorkflowsPage.tsx` was redesigned as an operator-focused studio:

- **Orchestration map** showing `Start → Qualifier → Decision` flow with HOT/WARM/COLD branch cards.
- **KPI strip** with total runs, success rate, and stream status.
- **Execution composer** with sample payload presets (HOT, WARM, COLD).
- **Real-time SSE event stream** panel.
- **Path metrics table** with traffic-share bars.
- **Execution history** with status chips.
- Inline error feedback for invalid payloads or failed executions.

---

## 8. Unstaged / Untracked Changes (working tree)

The following files are modified but not yet committed:

| File | Status |
|---|---|
| `.env.example` | Modified |
| `package.json` / `package-lock.json` | Modified |
| `src/api/settings.ts` | Modified |
| `src/mastra/framework.ts` | Modified |
| `src/mastra/tools/*.tool.ts` | Modified |
| `src/mastra/utils/claude-runner.ts` | Modified |
| `src/prompts/index.ts` | Modified |
| `src/testing/ab-test.ts` | Modified |
| `src/types/index.ts` | Modified |
| `tests/sales-qualifier.test.ts` | Modified |
| `tests/support-triage.test.ts` | Modified |

New untracked files:

| File | Description |
|---|---|
| `API_TESTS.md` | API testing documentation |
| `SYSTEM_FLOW.md` | System flow documentation |
| `tests/accuracy.eval.ts` | Accuracy evaluation suite |
| `tests/edge-cases.test.ts` | Edge case test suite |
| `tests/runner.test.ts` | Runner test suite |

---

## 9. Documentation Updates

- **`README.md`** — updated project structure section to reflect the `src/mastra/` layout.
- **`UI_GUIDE.md`** — expanded with unified shell description, keyboard shortcuts reference, mobile navigation details, and a Workflow Studio usage guide.
