# UI Guide

## Overview

AgentFlow Dashboard lives in `ui/web/dashboard/` and provides operational interfaces for agents, workflows, A/B testing, playground validation, monitoring, and settings management.

The UI now uses a unified shell with:

- Sticky desktop sidebar navigation.
- Mobile quick-tab navigation.
- Route-aware section controls (previous/next).
- Quick Jump command panel for fast keyboard-driven navigation.

## Run UI

```bash
npm --prefix ui/web/dashboard install
npm --prefix ui/web/dashboard run dev
```

Open `http://localhost:5173`.

Build for production preview:

```bash
npm run build:dashboard
```

## Routes

- `/`: KPI dashboard, trend charts, activity feed.
- `/agents`: agent table with status and performance.
- `/agents/:agentId`: overview, executions, metrics, prompts, settings tabs.
- `/workflows`: Workflow Studio with branch map, execution form, SSE trace stream, and path analytics.
- `/ab-tests`: create tests, compare variants, promote winner.
- `/playground`: execute agents interactively with JSON input/output.
- `/monitoring`: live WebSocket metrics, error logs, alert rules.
- `/settings`: integration and notification settings.

## Navigation

### Desktop

- Left sidebar is sticky and highlights the active route.
- Top section bar includes:
	- previous section button
	- quick jump launcher
	- next section button

### Mobile

- Compact top header shows current section.
- Previous/next route pills are available above the nav tabs.
- Horizontal route tabs support quick thumb navigation.

### Keyboard Shortcuts

- `Cmd/Ctrl + K`: open or close Quick Jump panel.
- `Alt + Left`: navigate to previous section.
- `Alt + Right`: navigate to next section.
- `Esc`: close Quick Jump panel.
- `Enter` in Quick Jump search: open first matched section.

## Workflow Studio (`/workflows`)

The workflows page is structured as an operator-focused studio:

- Orchestration map for Smart Lead flow (`Start -> Qualifier -> Decision`).
- Branch cards for HOT, WARM, COLD behavior.
- KPI strip for total runs, success rate, and stream status.
- Execution composer with sample payload presets (`HOT`, `WARM`, `COLD`).
- Real-time SSE event stream panel.
- Path metrics table with traffic-share bars.
- Execution history with status chips and icons.

### Execute a Workflow

1. Open `/workflows`.
2. Choose a preset (`HOT`, `WARM`, or `COLD`) or edit JSON manually.
3. Click `Run Workflow`.
4. Observe SSE updates in real time.
5. Review updated path metrics and execution history.

If payload JSON is invalid or execution fails, the page surfaces inline error feedback.

## A/B Wizard

1. Open `/ab-tests`.
2. Fill `agentType`, `variantA`, `variantB`, `runsPerSample`, and sample payload JSON.
3. Click `Create A/B Test`.
4. Select a historical test to view side-by-side metrics and significance.
5. Click `Deploy Variant X` to promote winner.

## Playground Usage

1. Choose agent in dropdown.
2. Edit JSON payload.
3. Click `Execute Agent`.
4. Review metrics and response JSON.
5. Save test case for replay.

## Monitoring

- Live feed consumes `ws://localhost:3000/ws/metrics`.
- Alert rules can be toggled inline.
- Error logs are sourced from recent failed executions.

## Accessibility Notes

- Buttons and form controls use semantic HTML.
- Inputs include labels.
- Keyboard navigation works across tabs, forms, and tables.
- Quick Jump and route controls are keyboard accessible.
