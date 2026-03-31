import { Pool } from 'pg';
import { randomUUID } from 'crypto';
import { createLogger, format, transports } from 'winston';
import { AgentMetrics } from '../../types';

const logger = createLogger({
  level: 'info',
  format: format.combine(format.timestamp(), format.json()),
  transports: [new transports.Console()],
});

export class PostgresStore {
  private readonly pool: Pool | null;
  private readonly enabled: boolean;

  constructor() {
    const connectionString = process.env.DATABASE_URL;
    const isMockMode = process.env.USE_MOCK_INTEGRATIONS === 'true';
    this.enabled = Boolean(connectionString) && !isMockMode;

    if (!this.enabled) {
      this.pool = null;
      logger.info('[PostgresStore] disabled', {
        reason: !connectionString ? 'missing_database_url' : 'mock_mode_enabled',
      });
      return;
    }

    this.pool = new Pool({
      connectionString,
      max: 5,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined,
    });
  }

  runMigrations = async (): Promise<void> => {
    if (!this.enabled || !this.pool) {
      logger.info('[PostgresStore] migration_skipped');
      return;
    }

    const sql = `
      CREATE TABLE IF NOT EXISTS agent_metrics (
        id UUID PRIMARY KEY,
        agent_name VARCHAR(64) NOT NULL,
        duration_ms INTEGER NOT NULL,
        tokens_used INTEGER NOT NULL,
        success BOOLEAN NOT NULL,
        validation_passed BOOLEAN NOT NULL,
        retry_count INTEGER NOT NULL,
        error TEXT,
        tier VARCHAR(24),
        priority VARCHAR(24),
        trace_id VARCHAR(64) NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `;

    try {
      await this.pool.query(sql);
      logger.info('[PostgresStore] migration_complete');
    } catch (error) {
      logger.warn('[PostgresStore] migration_failed', { error: String(error) });
    }
  };

  saveAgentMetrics = async (traceId: string, metrics: AgentMetrics): Promise<void> => {
    if (!this.enabled || !this.pool) {
      return;
    }

    const sql = `
      INSERT INTO agent_metrics (
        id, agent_name, duration_ms, tokens_used, success, validation_passed,
        retry_count, error, tier, priority, trace_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11);
    `;

    try {
      await this.pool.query(sql, [
        randomUUID(),
        metrics.agentName,
        metrics.durationMs,
        metrics.tokensUsed,
        metrics.success,
        metrics.validationPassed,
        metrics.retryCount,
        metrics.error || null,
        metrics.tier || null,
        metrics.priority || null,
        traceId,
      ]);
    } catch (error) {
      logger.warn('[PostgresStore] save_metrics_failed', { traceId, error: String(error) });
    }
  };
}

export const postgresStore = new PostgresStore();
