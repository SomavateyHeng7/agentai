import {
  Registry,
  Counter,
  Histogram,
  collectDefaultMetrics,
} from 'prom-client';
import { AgentMetrics } from '../types';
import { Request, Response, NextFunction } from 'express';

// ─── Prometheus Registry ──────────────────────────────────────────────────────

const registry = new Registry();
registry.setDefaultLabels({ app: 'agentflow' });

collectDefaultMetrics({ register: registry });

// ─── Metric Definitions ───────────────────────────────────────────────────────

const agentExecutionTotal = new Counter({
  name: 'agent_execution_total',
  help: 'Total number of agent executions',
  labelNames: ['agent_name', 'success', 'tier', 'priority'],
  registers: [registry],
});

const agentDurationSeconds = new Histogram({
  name: 'agent_duration_seconds',
  help: 'Duration of agent executions in seconds',
  labelNames: ['agent_name'],
  buckets: [0.1, 0.5, 1, 2, 5, 10, 20, 30, 60],
  registers: [registry],
});

const agentTokensUsed = new Histogram({
  name: 'agent_tokens_used',
  help: 'Number of tokens consumed per agent execution',
  labelNames: ['agent_name'],
  buckets: [100, 500, 1000, 2000, 4000, 8000, 16000, 32000],
  registers: [registry],
});

const agentValidationFailuresTotal = new Counter({
  name: 'agent_validation_failures_total',
  help: 'Total number of input or output validation failures',
  labelNames: ['agent_name'],
  registers: [registry],
});

const agentRetryTotal = new Counter({
  name: 'agent_retry_total',
  help: 'Total number of agent execution retries',
  labelNames: ['agent_name'],
  registers: [registry],
});

const agentErrorTotal = new Counter({
  name: 'agent_error_total',
  help: 'Total number of agent errors by type',
  labelNames: ['agent_name', 'error_type'],
  registers: [registry],
});

// ─── Record Execution ─────────────────────────────────────────────────────────

export function recordExecution(metrics: AgentMetrics): void {
  // Record execution counter
  agentExecutionTotal.inc({
    agent_name: metrics.agentName,
    success: metrics.success.toString(),
    tier: metrics.tier || 'none',
    priority: metrics.priority || 'none',
  });

  // Record duration
  agentDurationSeconds.observe(
    { agent_name: metrics.agentName },
    metrics.durationMs / 1000
  );

  // Record tokens
  if (metrics.tokensUsed > 0) {
    agentTokensUsed.observe(
      { agent_name: metrics.agentName },
      metrics.tokensUsed
    );
  }

  // Record validation failures
  if (!metrics.validationPassed) {
    agentValidationFailuresTotal.inc({ agent_name: metrics.agentName });
  }

  // Record retries
  if (metrics.retryCount > 0) {
    agentRetryTotal.inc(
      { agent_name: metrics.agentName },
      metrics.retryCount
    );
  }

  // Record errors
  if (!metrics.success && metrics.error) {
    const errorType = categorizeError(metrics.error);
    agentErrorTotal.inc({
      agent_name: metrics.agentName,
      error_type: errorType,
    });
  }
}

// ─── Error Categorization ─────────────────────────────────────────────────────

function categorizeError(error: string): string {
  const lower = error.toLowerCase();
  if (lower.includes('timeout')) return 'timeout';
  if (lower.includes('rate limit') || lower.includes('429')) return 'rate_limit';
  if (lower.includes('validation') || lower.includes('zod')) return 'validation';
  if (lower.includes('json') || lower.includes('parse')) return 'parse_error';
  if (lower.includes('network') || lower.includes('connect')) return 'network';
  if (lower.includes('auth') || lower.includes('401') || lower.includes('403')) return 'auth';
  return 'unknown';
}

// ─── Get Registry ─────────────────────────────────────────────────────────────

export function getRegistry(): Registry {
  return registry;
}

// ─── Metrics Middleware ───────────────────────────────────────────────────────

export function metricsMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const start = Date.now();

  res.on('finish', () => {
    const duration = (Date.now() - start) / 1000;
    // HTTP request metrics are collected by default metrics
    // Additional request tracking can be added here
    void duration;
  });

  next();
}

// ─── Metrics Endpoint Handler ─────────────────────────────────────────────────

export async function metricsHandler(req: Request, res: Response): Promise<void> {
  try {
    res.set('Content-Type', registry.contentType);
    const metrics = await registry.metrics();
    res.end(metrics);
  } catch (error) {
    res.status(500).end(String(error));
  }
}
