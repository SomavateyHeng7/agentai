import { createLogger, format, transports } from 'winston';
import { ApiResponse, SalesLeadSchema, SalesQualificationResult } from '../types';
import { BaseAgent } from './base-agent';

const logger = createLogger({
  level: 'info',
  format: format.combine(format.timestamp(), format.json()),
  transports: [new transports.Console()],
});

export class SalesQualifier extends BaseAgent {

  async qualify(input: unknown): Promise<ApiResponse<SalesQualificationResult>> {
    return this.executeValidated({
      input,
      schema: SalesLeadSchema,
      workflowName: 'sales-qualification-workflow',
      logger,
      logLabel: 'SalesQualifier',
      metadata: (parsed) => ({
        company: parsed.company,
        source: parsed.source,
      }),
    });
  }
}

// ─── Singleton Export ─────────────────────────────────────────────────────────

export const salesQualifier = new SalesQualifier();
