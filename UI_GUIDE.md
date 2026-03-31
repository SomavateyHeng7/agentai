# UI Guide

## Overview

AgentFlow Dashboard lives in `ui/web/dashboard/` and provides operational interfaces for agents, workflows, A/B testing, playground validation, monitoring, and settings management.

## Run UI

```bash
npm --prefix ui/web/dashboard install
npm --prefix ui/web/dashboard run dev
```

Open `http://localhost:5173`.

## Routes

- `/`: KPI dashboard, trend charts, activity feed.
- `/agents`: agent table with status and performance.
- `/agents/:agentId`: overview, executions, metrics, prompts, settings tabs.
- `/workflows`: workflow execution + SSE stream + path metrics.
- `/ab-tests`: create tests, compare variants, promote winner.
- `/playground`: execute agents interactively with JSON input/output.
- `/monitoring`: live WebSocket metrics, error logs, alert rules.
- `/settings`: integration and notification settings.

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
