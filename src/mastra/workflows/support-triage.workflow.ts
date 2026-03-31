import { z } from 'zod';
import { ApiResponse, AgentMetrics, SupportTicketSchema, SupportTriageResult } from '../../types';
import { saveMetrics } from '../../integrations/database';
import { recordExecution } from '../../observability/metrics';
import { AGENT_VERSION } from '../constants';
import { WorkflowDefinition } from '../framework';
import { logBusinessAction } from '../observability';
import { postgresStore } from '../store/postgres-store';
import { createZendeskTicketTool } from '../tools/create-zendesk-ticket.tool';
import { triageSupportTicketTool } from '../tools/triage-support-ticket.tool';

const workflowInputSchema = SupportTicketSchema.extend({
  traceId: z.string().min(1),
});

type SupportWorkflowInput = z.infer<typeof workflowInputSchema>;

export const supportTriageWorkflow: WorkflowDefinition<
  SupportWorkflowInput,
  ApiResponse<SupportTriageResult>
> = {
  name: 'support-triage-workflow',
  run: async (input, context) => {
    const start = Date.now();
    let tokensUsed = 0;
    let retryCount = 0;

    logBusinessAction('entry', {
      traceId: context.traceId,
      action: 'workflow.supportTriage',
      metadata: { ticketId: input.id, subject: input.subject },
    });

    try {
      const parsedInput = workflowInputSchema.parse(input);
      const triage = await triageSupportTicketTool.execute(parsedInput, context);
      tokensUsed = triage.tokensUsed;
      retryCount = triage.retryCount;

      const responseData: SupportTriageResult = {
        ...triage.result,
      };

      try {
        const zendesk = await createZendeskTicketTool.execute(
          {
            traceId: context.traceId,
            ticket: parsedInput,
            triage: triage.result,
          },
          context
        );

        responseData.zendeskData = {
          ticketId: zendesk.ticketId,
          status: zendesk.status,
          assigneeGroup: zendesk.assigneeGroup,
        };
      } catch {
        // Non-fatal integration failure; keep triage response.
      }

      const durationMs = Date.now() - start;
      const metrics: AgentMetrics = {
        agentName: 'support-triage',
        durationMs,
        tokensUsed,
        success: true,
        validationPassed: true,
        retryCount,
        priority: responseData.priority,
      };

      await Promise.all([
        saveMetrics(metrics),
        postgresStore.saveAgentMetrics(context.traceId, metrics),
      ]);
      recordExecution(metrics);

      logBusinessAction('exit', {
        traceId: context.traceId,
        action: 'workflow.supportTriage',
        metadata: { priority: responseData.priority, team: responseData.team, durationMs },
      });

      return {
        success: true,
        data: responseData,
        meta: {
          durationMs,
          tokensUsed,
          retryCount,
          agentVersion: AGENT_VERSION,
        },
      };
    } catch (error) {
      const durationMs = Date.now() - start;
      const metrics: AgentMetrics = {
        agentName: 'support-triage',
        durationMs,
        tokensUsed,
        success: false,
        validationPassed: false,
        retryCount,
        error: String(error),
      };

      await Promise.all([
        saveMetrics(metrics),
        postgresStore.saveAgentMetrics(context.traceId, metrics),
      ]);
      recordExecution(metrics);

      logBusinessAction('error', {
        traceId: context.traceId,
        action: 'workflow.supportTriage',
        metadata: { error: String(error), durationMs },
      });

      return {
        success: false,
        error: String(error),
        meta: {
          durationMs,
          tokensUsed,
          retryCount,
          agentVersion: AGENT_VERSION,
        },
      };
    }
  },
};
