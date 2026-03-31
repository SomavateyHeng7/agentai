import { z } from 'zod';
import { ApiResponse, AgentMetrics, ContentRequestSchema, ContentResult } from '../../types';
import { saveMetrics } from '../../integrations/database';
import { recordExecution } from '../../observability/metrics';
import { AGENT_VERSION } from '../constants';
import { WorkflowDefinition } from '../framework';
import { logBusinessAction } from '../observability';
import { postgresStore } from '../store/postgres-store';
import { generateContentTool } from '../tools/generate-content.tool';

const workflowInputSchema = ContentRequestSchema.extend({
  traceId: z.string().min(1),
});

type ContentWorkflowInput = z.infer<typeof workflowInputSchema>;

export const contentGenerationWorkflow: WorkflowDefinition<
  ContentWorkflowInput,
  ApiResponse<ContentResult>
> = {
  name: 'content-generation-workflow',
  run: async (input, context) => {
    const start = Date.now();

    logBusinessAction('entry', {
      traceId: context.traceId,
      action: 'workflow.contentGeneration',
      metadata: { type: input.type, topic: input.topic },
    });

    try {
      const parsedInput = workflowInputSchema.parse(input);
      const generated = await generateContentTool.execute(parsedInput, context);

      const durationMs = Date.now() - start;
      const metrics: AgentMetrics = {
        agentName: 'content-generator',
        durationMs,
        tokensUsed: generated.tokensUsed,
        success: true,
        validationPassed: true,
        retryCount: generated.retryCount,
      };

      await Promise.all([
        saveMetrics(metrics),
        postgresStore.saveAgentMetrics(context.traceId, metrics),
      ]);
      recordExecution(metrics);

      logBusinessAction('exit', {
        traceId: context.traceId,
        action: 'workflow.contentGeneration',
        metadata: { wordCount: generated.result.wordCount, durationMs },
      });

      return {
        success: true,
        data: generated.result,
        meta: {
          durationMs,
          tokensUsed: generated.tokensUsed,
          retryCount: generated.retryCount,
          agentVersion: AGENT_VERSION,
        },
      };
    } catch (error) {
      const durationMs = Date.now() - start;
      const metrics: AgentMetrics = {
        agentName: 'content-generator',
        durationMs,
        tokensUsed: 0,
        success: false,
        validationPassed: false,
        retryCount: 0,
        error: String(error),
      };

      await Promise.all([
        saveMetrics(metrics),
        postgresStore.saveAgentMetrics(context.traceId, metrics),
      ]);
      recordExecution(metrics);

      logBusinessAction('error', {
        traceId: context.traceId,
        action: 'workflow.contentGeneration',
        metadata: { error: String(error), durationMs },
      });

      return {
        success: false,
        error: String(error),
        meta: {
          durationMs,
          tokensUsed: 0,
          retryCount: 0,
          agentVersion: AGENT_VERSION,
        },
      };
    }
  },
};
