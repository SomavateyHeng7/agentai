import { Logger } from 'winston';
import { z } from 'zod';
import { mastra, initializeMastra } from '../mastra';
import { AGENT_VERSION } from '../mastra/constants';
import { createTraceId } from '../mastra/observability';
import { ApiResponse } from '../types';

interface ExecuteConfig<TParsed extends Record<string, unknown>> {
  input: unknown;
  schema: z.ZodType<TParsed>;
  workflowName: string;
  logger: Logger;
  logLabel: string;
  metadata: (parsed: TParsed) => Record<string, unknown>;
}

export abstract class BaseAgent {
  protected readonly initPromise: Promise<void>;

  constructor() {
    this.initPromise = initializeMastra();
  }

  protected async executeValidated<TParsed extends Record<string, unknown>, TResult>(
    config: ExecuteConfig<TParsed>
  ): Promise<ApiResponse<TResult>> {
    await this.initPromise;

    const parsed = config.schema.safeParse(config.input);
    if (!parsed.success) {
      const errorMsg = parsed.error.errors
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
    config.logger.info(`[${config.logLabel}] run_workflow`, {
      traceId,
      ...config.metadata(parsed.data),
    });

    const workflow = mastra.getWorkflow<
      { traceId: string } & TParsed,
      ApiResponse<TResult>
    >(config.workflowName);

    return workflow.run(
      {
        ...parsed.data,
        traceId,
      },
      { traceId }
    );
  }
}