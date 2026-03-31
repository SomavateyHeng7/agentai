import { createLogger, format, transports } from 'winston';
import { ApiResponse, SupportTicketSchema, SupportTriageResult } from '../types';
import { BaseAgent } from './base-agent';

const logger = createLogger({
  level: 'info',
  format: format.combine(format.timestamp(), format.json()),
  transports: [new transports.Console()],
});

export class SupportTriage extends BaseAgent {

  async triage(input: unknown): Promise<ApiResponse<SupportTriageResult>> {
    return this.executeValidated({
      input,
      schema: SupportTicketSchema,
      workflowName: 'support-triage-workflow',
      logger,
      logLabel: 'SupportTriage',
      metadata: (parsed) => ({
        ticketId: parsed.id,
        subject: parsed.subject,
      }),
    });
  }
}

// ─── Singleton Export ─────────────────────────────────────────────────────────

export const supportTriage = new SupportTriage();
