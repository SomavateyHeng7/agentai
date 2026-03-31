import { z } from 'zod';
import { ApiResponse, AgentMetrics, SalesLeadSchema, SalesQualificationResult } from '../../types';
import { saveMetrics } from '../../integrations/database';
import { recordExecution } from '../../observability/metrics';
import { AGENT_VERSION } from '../constants';
import { WorkflowDefinition } from '../framework';
import { logBusinessAction } from '../observability';
import { postgresStore } from '../store/postgres-store';
import { createSalesforceLeadTool } from '../tools/create-salesforce-lead.tool';
import { qualifySalesLeadTool } from '../tools/qualify-sales-lead.tool';
import { scheduleSalesMeetingTool } from '../tools/schedule-sales-meeting.tool';
import { runOrchestration } from './orchestration-runner';

const shouldScheduleMeeting = (tier: SalesQualificationResult['tier'], nextAction: string): boolean => {
  if (tier === 'HOT') {
    return true;
  }

  return /meeting|demo|call/.test(nextAction.toLowerCase());
};

const workflowInputSchema = SalesLeadSchema.extend({
  traceId: z.string().min(1),
});

type SalesforceMeetingWorkflowInput = z.infer<typeof workflowInputSchema>;

interface SalesforceMeetingOrchestrationContext {
  traceId: string;
  lead: z.infer<typeof SalesLeadSchema>;
  responseData?: SalesQualificationResult;
  tokensUsed: number;
  retryCount: number;
}

export const salesforceMeetingOrchestrationWorkflow: WorkflowDefinition<
  SalesforceMeetingWorkflowInput,
  ApiResponse<SalesQualificationResult>
> = {
  name: 'salesforce-meeting-orchestration-workflow',
  run: async (input, context) => {
    const start = Date.now();

    logBusinessAction('entry', {
      traceId: context.traceId,
      action: 'workflow.salesforceMeetingOrchestration',
      metadata: { company: input.company, source: input.source },
    });

    try {
      const parsedInput = workflowInputSchema.parse(input);
      const orchestrationContext: SalesforceMeetingOrchestrationContext = {
        traceId: context.traceId,
        lead: parsedInput,
        tokensUsed: 0,
        retryCount: 0,
      };

      const orchestration = await runOrchestration({
        workflowName: 'salesforce-meeting-orchestration-workflow',
        context: orchestrationContext,
        steps: [
          // Step 1: lead qualification is required and seeds downstream steps.
          {
            name: 'qualify-lead',
            run: async (ctx) => {
              const qualification = await qualifySalesLeadTool.execute(
                { ...ctx.lead, traceId: ctx.traceId },
                { traceId: ctx.traceId }
              );

              ctx.tokensUsed = qualification.tokensUsed;
              ctx.retryCount = qualification.retryCount;
              ctx.responseData = { ...qualification.result };
            },
          },
          // Step 2: CRM sync is optional so orchestration still succeeds if CRM is unavailable.
          {
            name: 'create-salesforce-lead',
            optional: true,
            run: async (ctx) => {
              if (!ctx.responseData) {
                throw new Error('Qualification result is required before Salesforce step.');
              }

              const salesforce = await createSalesforceLeadTool.execute(
                {
                  traceId: ctx.traceId,
                  lead: ctx.lead,
                  qualification: ctx.responseData,
                },
                { traceId: ctx.traceId }
              );

              ctx.responseData.salesforceData = {
                leadId: salesforce.leadId,
                opportunityId: salesforce.opportunityId,
                status: salesforce.status,
              };
            },
          },
          // Step 3: meeting scheduling runs only when qualification indicates call intent.
          {
            name: 'schedule-meeting',
            optional: true,
            skip: (ctx) => {
              if (!ctx.responseData) {
                return true;
              }

              return !shouldScheduleMeeting(ctx.responseData.tier, ctx.responseData.nextAction);
            },
            run: async (ctx) => {
              if (!ctx.responseData) {
                throw new Error('Qualification result is required before meeting step.');
              }

              const meeting = await scheduleSalesMeetingTool.execute(
                {
                  traceId: ctx.traceId,
                  lead: ctx.lead,
                  qualification: ctx.responseData,
                },
                { traceId: ctx.traceId }
              );

              ctx.responseData.meetingData = {
                meetingId: meeting.meetingId,
                status: meeting.status,
                scheduledAt: meeting.scheduledAt,
                meetingUrl: meeting.meetingUrl,
              };
            },
          },
        ],
      });

      if (!orchestration.context.responseData) {
        throw new Error('Orchestration completed without a qualification result.');
      }

      const durationMs = Date.now() - start;
      const metrics: AgentMetrics = {
        agentName: 'sales-orchestrator',
        durationMs,
        tokensUsed: orchestration.context.tokensUsed,
        success: true,
        validationPassed: true,
        retryCount: orchestration.context.retryCount,
        tier: orchestration.context.responseData.tier,
      };

      await Promise.all([
        saveMetrics(metrics),
        postgresStore.saveAgentMetrics(context.traceId, metrics),
      ]);
      recordExecution(metrics);

      logBusinessAction('exit', {
        traceId: context.traceId,
        action: 'workflow.salesforceMeetingOrchestration',
        metadata: {
          score: orchestration.context.responseData.score,
          tier: orchestration.context.responseData.tier,
          durationMs,
          stepResults: orchestration.stepResults,
        },
      });

      return {
        success: true,
        data: orchestration.context.responseData,
        meta: {
          durationMs,
          tokensUsed: orchestration.context.tokensUsed,
          retryCount: orchestration.context.retryCount,
          agentVersion: AGENT_VERSION,
        },
      };
    } catch (error) {
      const durationMs = Date.now() - start;
      const metrics: AgentMetrics = {
        agentName: 'sales-orchestrator',
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
        action: 'workflow.salesforceMeetingOrchestration',
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
