import { scheduleSalesMeetingTool } from '../../mastra/tools/schedule-sales-meeting.tool';
import { WorkflowActionContext } from '../types';
import { withRetry } from './retry';

export const scheduleCalendarAction = async (
  context: WorkflowActionContext
): Promise<{
  meetingId: string;
  status: 'scheduled' | 'pending';
  scheduledAt: string;
  meetingUrl: string;
}> => {
  return withRetry(async () =>
    scheduleSalesMeetingTool.execute(
      {
        traceId: context.traceId,
        lead: context.lead,
        qualification: context.qualification,
      },
      { traceId: context.traceId }
    )
  );
};
