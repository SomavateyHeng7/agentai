import { AgentMetrics, AggregatedStats } from '../types';
import { createLogger, format, transports } from 'winston';

const logger = createLogger({
  level: 'info',
  format: format.combine(format.timestamp(), format.json()),
  transports: [new transports.Console()],
});

// ─── In-Memory Store (Mock PostgreSQL) ───────────────────────────────────────

interface StoredMetrics extends AgentMetrics {
  id: string;
  timestamp: Date;
}

const metricsStore: StoredMetrics[] = [];
let idCounter = 1;

// ─── Save Metrics ─────────────────────────────────────────────────────────────

export async function saveMetrics(metrics: AgentMetrics): Promise<string> {
  const id = `metric_${idCounter++}`;
  const stored: StoredMetrics = {
    ...metrics,
    id,
    timestamp: new Date(),
  };
  metricsStore.push(stored);
  logger.info('[DB] Metrics saved', { id, agentName: metrics.agentName });
  return id;
}

// ─── Get Metrics ──────────────────────────────────────────────────────────────

export async function getMetrics(agentName?: string): Promise<StoredMetrics[]> {
  if (agentName) {
    return metricsStore.filter((m) => m.agentName === agentName);
  }
  return [...metricsStore];
}

// ─── Get Aggregated Stats ─────────────────────────────────────────────────────

export async function getAggregatedStats(agentName?: string): Promise<AggregatedStats> {
  const records = await getMetrics(agentName);

  if (records.length === 0) {
    return {
      totalExecutions: 0,
      successRate: 0,
      avgDurationMs: 0,
      avgTokensUsed: 0,
      avgRetryCount: 0,
      validationPassRate: 0,
    };
  }

  const totalExecutions = records.length;
  const successCount = records.filter((r) => r.success).length;
  const validationPassCount = records.filter((r) => r.validationPassed).length;

  const avgDurationMs =
    records.reduce((sum, r) => sum + r.durationMs, 0) / totalExecutions;
  const avgTokensUsed =
    records.reduce((sum, r) => sum + r.tokensUsed, 0) / totalExecutions;
  const avgRetryCount =
    records.reduce((sum, r) => sum + r.retryCount, 0) / totalExecutions;

  return {
    totalExecutions,
    successRate: (successCount / totalExecutions) * 100,
    avgDurationMs: Math.round(avgDurationMs),
    avgTokensUsed: Math.round(avgTokensUsed),
    avgRetryCount: parseFloat(avgRetryCount.toFixed(2)),
    validationPassRate: (validationPassCount / totalExecutions) * 100,
  };
}

// ─── Get Dashboard Stats (all agents) ────────────────────────────────────────

export interface DashboardStats {
  overall: AggregatedStats;
  byAgent: Record<string, AggregatedStats>;
  recentMetrics: StoredMetrics[];
}

export async function getDashboardStats(): Promise<DashboardStats> {
  const agentNames = ['sales-qualifier', 'support-triage', 'content-generator'] as const;

  const overall = await getAggregatedStats();
  const byAgent: Record<string, AggregatedStats> = {};

  for (const name of agentNames) {
    byAgent[name] = await getAggregatedStats(name);
  }

  const allMetrics = await getMetrics();
  const recentMetrics = allMetrics
    .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
    .slice(0, 20);

  return { overall, byAgent, recentMetrics };
}

// ─── Run Migrations ───────────────────────────────────────────────────────────

export async function runMigrations(): Promise<void> {
  logger.info('[DB] Running migrations (mock mode — no real DB)');
  logger.info('[DB] Mock migration complete. Schema:');
  logger.info('[DB]   Table: agent_metrics');
  logger.info('[DB]     - id UUID PRIMARY KEY');
  logger.info('[DB]     - agent_name VARCHAR(50)');
  logger.info('[DB]     - duration_ms INTEGER');
  logger.info('[DB]     - tokens_used INTEGER');
  logger.info('[DB]     - success BOOLEAN');
  logger.info('[DB]     - validation_passed BOOLEAN');
  logger.info('[DB]     - retry_count INTEGER');
  logger.info('[DB]     - error TEXT');
  logger.info('[DB]     - tier VARCHAR(20)');
  logger.info('[DB]     - priority VARCHAR(20)');
  logger.info('[DB]     - created_at TIMESTAMPTZ DEFAULT NOW()');
  logger.info('[DB] Migrations complete.');
}

// ─── Clear Store (for testing) ────────────────────────────────────────────────

export function clearMetricsStore(): void {
  metricsStore.length = 0;
  idCounter = 1;
}
