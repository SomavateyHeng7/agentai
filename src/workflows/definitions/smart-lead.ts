import { randomUUID } from 'crypto';
import { SalesLead, SalesQualificationResult } from '../../types';
import { salesQualifier } from '../../agents/sales-qualifier';
import { createSalesforceLeadTool } from '../../mastra/tools/create-salesforce-lead.tool';
import { sendEmailAction } from '../actions/email';
import { sendSlackAction } from '../actions/slack';
import { scheduleCalendarAction } from '../actions/calendar';
import { WorkflowExecution, WorkflowRuntime } from '../types';

const nowIso = (): string => new Date().toISOString();

const buildBaseExecution = (executionId: string, input: SalesLead): WorkflowExecution => ({
  executionId,
  workflowName: 'smart-lead',
  status: 'running',
  input,
  startedAt: nowIso(),
  path: [],
  steps: [],
  metrics: {
    durationMs: 0,
    success: false,
    branch: 'UNQUALIFIED',
  },
});

const runStep = async (
  execution: WorkflowExecution,
  runtime: WorkflowRuntime,
  stepName: string,
  action: () => Promise<unknown>,
  skip = false
): Promise<void> => {
  const startedAt = Date.now();

  if (skip) {
    execution.steps.push({
      name: stepName,
      status: 'skipped',
      startedAt: nowIso(),
      endedAt: nowIso(),
      durationMs: 0,
    });
    runtime.emitter.emit(execution.executionId, execution);
    return;
  }

  try {
    const rawMetadata = await action();
    const metadata =
      rawMetadata && typeof rawMetadata === 'object'
        ? (rawMetadata as Record<string, unknown>)
        : undefined;
    execution.steps.push({
      name: stepName,
      status: 'success',
      startedAt: new Date(startedAt).toISOString(),
      endedAt: nowIso(),
      durationMs: Date.now() - startedAt,
      metadata,
    });
  } catch (error) {
    execution.steps.push({
      name: stepName,
      status: 'failed',
      startedAt: new Date(startedAt).toISOString(),
      endedAt: nowIso(),
      durationMs: Date.now() - startedAt,
      error: String(error),
    });
    throw error;
  } finally {
    runtime.emitter.emit(execution.executionId, execution);
  }
};

export const executeSmartLeadWorkflow = async (
  lead: SalesLead,
  runtime: WorkflowRuntime
): Promise<WorkflowExecution> => {
  const executionId = randomUUID();
  const execution = buildBaseExecution(executionId, lead);
  runtime.executions.set(executionId, execution);
  runtime.emitter.emit(executionId, execution);

  const traceId = randomUUID();
  let qualification: SalesQualificationResult | undefined;

  try {
    await runStep(execution, runtime, 'qualify-lead', async () => {
      const result = await salesQualifier.qualify(lead);
      if (!result.success || !result.data) {
        throw new Error(result.error || 'Qualification failed.');
      }

      qualification = result.data;
      execution.metrics.branch = result.data.tier;
      execution.path.push(`tier:${result.data.tier}`);
      execution.result = result.data;
      return {
        score: result.data.score,
        tier: result.data.tier,
      };
    });

    if (!qualification) {
      throw new Error('Qualification missing after qualification step.');
    }

    const qualifiedLead = qualification;

    const actionContext = {
      traceId,
      executionId,
      lead,
      qualification: qualifiedLead,
    };

    const isHot = qualifiedLead.score > 80;
    const isWarm = qualifiedLead.score >= 60 && qualifiedLead.score <= 79;
    const isCold = qualifiedLead.score >= 40 && qualifiedLead.score <= 59;

    await runStep(execution, runtime, 'create-salesforce-lead', async () => {
      const response = await createSalesforceLeadTool.execute(
        {
          traceId,
          lead,
          qualification: qualifiedLead,
        },
        { traceId }
      );

      execution.result = {
        ...qualifiedLead,
        salesforceData: {
          leadId: response.leadId,
          opportunityId: response.opportunityId,
          status: response.status,
        },
      };

      return response;
    }, !isHot && !isWarm);

    await runStep(execution, runtime, 'hot-path-parallel-actions', async () => {
      if (!isHot) {
        return;
      }

      const [meeting] = await Promise.all([
        scheduleCalendarAction(actionContext),
        sendSlackAction(
          {
            channel: '#sales-alerts',
            message: `HOT lead: ${lead.company} (${lead.email}) score ${qualifiedLead.score}`,
          },
          actionContext
        ),
        sendEmailAction(
          {
            to: 'sales@agentflow.local',
            subject: `HOT lead for ${lead.company}`,
            body: qualifiedLead.nextAction,
          },
          actionContext
        ),
      ]);

      execution.path.push('branch:hot');
      execution.result = {
        ...qualifiedLead,
        meetingData: {
          meetingId: meeting.meetingId,
          status: meeting.status,
          scheduledAt: meeting.scheduledAt,
          meetingUrl: meeting.meetingUrl,
        },
      };

      return { meetingId: meeting.meetingId };
    }, !isHot);

    await runStep(execution, runtime, 'warm-path-nurture', async () => {
      execution.path.push('branch:warm');
      await sendEmailAction(
        {
          to: lead.email,
          subject: `Thanks for your interest, ${lead.company}`,
          body: 'We added you to our nurture sequence and will follow up with tailored resources.',
        },
        actionContext
      );
    }, !isWarm);

    await runStep(execution, runtime, 'cold-path-newsletter', async () => {
      execution.path.push('branch:cold');
      await sendEmailAction(
        {
          to: lead.email,
          subject: 'Welcome to AgentFlow insights',
          body: 'You have been subscribed to our newsletter for product updates and best practices.',
        },
        actionContext
      );
    }, !isCold);

    execution.status = 'completed';
    execution.completedAt = nowIso();
    execution.metrics.durationMs = Date.now() - new Date(execution.startedAt).getTime();
    execution.metrics.success = true;
    runtime.emitter.emit(execution.executionId, execution);
    return execution;
  } catch (error) {
    execution.status = 'failed';
    execution.error = String(error);
    execution.completedAt = nowIso();
    execution.metrics.durationMs = Date.now() - new Date(execution.startedAt).getTime();
    execution.metrics.success = false;
    runtime.emitter.emit(execution.executionId, execution);
    return execution;
  }
};
