import { z } from 'zod';
import { SalesLeadSchema, SalesQualificationResult, ApiResponse, AgentMetrics } from '../../types';
import { saveMetrics } from '../../integrations/database';
import { recordExecution } from '../../observability/metrics';
import { AGENT_VERSION } from '../constants';
import { WorkflowDefinition } from '../framework';
import { logBusinessAction } from '../observability';
import { postgresStore } from '../store/postgres-store';
import { createSalesforceLeadTool } from '../tools/create-salesforce-lead.tool';
import { qualifySalesLeadTool } from '../tools/qualify-sales-lead.tool';
import { scheduleSalesMeetingTool } from '../tools/schedule-sales-meeting.tool';

const shouldScheduleMeeting = (tier: SalesQualificationResult['tier'], nextAction: string): boolean => {
  if (tier === 'HOT') {
    return true;
  }

  return /meeting|demo|call/.test(nextAction.toLowerCase());
};

const workflowInputSchema = SalesLeadSchema.extend({
  traceId: z.string().min(1),
});

type SalesWorkflowInput = z.infer<typeof workflowInputSchema>;

export const salesQualificationWorkflow: WorkflowDefinition<
  SalesWorkflowInput,
  ApiResponse<SalesQualificationResult>
> = {
  name: 'sales-qualification-workflow',
  run: async (input, context) => {
    const start = Date.now();
    let tokensUsed = 0;
    let retryCount = 0;

    logBusinessAction('entry', {
      traceId: context.traceId,
      action: 'workflow.salesQualification',
      metadata: { company: input.company },
    });

    try {
      const parsedInput = workflowInputSchema.parse(input);
      const qualification = await qualifySalesLeadTool.execute(parsedInput, context);
      tokensUsed = qualification.tokensUsed;
      retryCount = qualification.retryCount;

      const responseData: SalesQualificationResult = {
        ...qualification.result,
      };

      try {
        const salesforce = await createSalesforceLeadTool.execute(
          {
            traceId: context.traceId,
            lead: parsedInput,
            qualification: qualification.result,
          },
          context
        );

        responseData.salesforceData = {
          leadId: salesforce.leadId,
          opportunityId: salesforce.opportunityId,
          status: salesforce.status,
        };
      } catch {
        // Non-fatal integration failure; keep qualification response.
      }

      if (shouldScheduleMeeting(responseData.tier, responseData.nextAction)) {
        try {
          const meeting = await scheduleSalesMeetingTool.execute(
            {
              traceId: context.traceId,
              lead: parsedInput,
              qualification: qualification.result,
            },
            context
          );

          responseData.meetingData = {
            meetingId: meeting.meetingId,
            status: meeting.status,
            scheduledAt: meeting.scheduledAt,
            meetingUrl: meeting.meetingUrl,
          };
        } catch {
          // Non-fatal integration failure; keep qualification response.
        }
      }

      const durationMs = Date.now() - start;
      const metrics: AgentMetrics = {
        agentName: 'sales-qualifier',
        durationMs,
        tokensUsed,
        success: true,
        validationPassed: true,
        retryCount,
        tier: responseData.tier,
      };

      await Promise.all([
        saveMetrics(metrics),
        postgresStore.saveAgentMetrics(context.traceId, metrics),
      ]);
      recordExecution(metrics);

      logBusinessAction('exit', {
        traceId: context.traceId,
        action: 'workflow.salesQualification',
        metadata: { score: responseData.score, tier: responseData.tier, durationMs },
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
        agentName: 'sales-qualifier',
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
        action: 'workflow.salesQualification',
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
