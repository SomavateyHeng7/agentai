import { createLogger, format, transports } from 'winston';
import { ApiResponse, SalesLeadSchema, SalesQualificationResult } from '../../types';
import { AGENT_VERSION } from '../constants';
import { createTraceId } from '../observability';
import { mastra, initializeMastra } from '../index';

const logger = createLogger({
  level: 'info',
  format: format.combine(format.timestamp(), format.json()),
  transports: [new transports.Console()],
});

export class SalesOrchestrator {
  private readonly initPromise: Promise<void>;

  constructor() {
    this.initPromise = initializeMastra();
  }

  async orchestrate(input: unknown): Promise<ApiResponse<SalesQualificationResult>> {
    await this.initPromise;

    const parsedLead = SalesLeadSchema.safeParse(input);
    if (!parsedLead.success) {
      const errorMsg = parsedLead.error.errors
        .map((error) => `${error.path.join('.')}: ${error.message}`)
        .join(', ');
      return {
        success: false,
        error: `Input validation failed: ${errorMsg}`,
        meta: {
          durationMs: 0,
          tokensUsed: 0,
          retryCount: 0,
          agentVersion: AGENT_VERSION,
        },
      };
    }

    const traceId = createTraceId();
    logger.info('[SalesOrchestrator] run_workflow', {
      traceId,
      company: parsedLead.data.company,
      source: parsedLead.data.source,
      objective: 'qualify + salesforce + meeting-scheduling',
    });

    const workflow = mastra.getWorkflow<
      { traceId: string } & typeof parsedLead.data,
      ApiResponse<SalesQualificationResult>
    >('salesforce-meeting-orchestration-workflow');

    return workflow.run(
      {
        ...parsedLead.data,
        traceId,
      },
      { traceId }
    );
  }
}

export const salesOrchestrator = new SalesOrchestrator();
