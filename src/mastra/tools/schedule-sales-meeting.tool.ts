import { z } from 'zod';
import { meetingsAdapter } from '../../integrations/meetings';
import { SalesLeadSchema, SalesQualificationResultSchema } from '../../types';
import { ToolDefinition } from '../framework';
import { logBusinessAction } from '../observability';

const scheduleSalesMeetingInputSchema = z.object({
  traceId: z.string().min(1),
  lead: SalesLeadSchema,
  qualification: SalesQualificationResultSchema,
});

type ScheduleSalesMeetingInput = z.infer<typeof scheduleSalesMeetingInputSchema>;

export interface ScheduleSalesMeetingOutput {
  meetingId: string;
  status: 'scheduled' | 'pending';
  scheduledAt: string;
  meetingUrl: string;
}

export const scheduleSalesMeetingTool: ToolDefinition<
  ScheduleSalesMeetingInput,
  ScheduleSalesMeetingOutput
> = {
  name: 'scheduleSalesMeeting',
  description: 'Schedules a discovery/demo meeting for qualified sales leads and returns booking details.',
  inputSchema: scheduleSalesMeetingInputSchema,
  execute: async (input, context) => {
    logBusinessAction('entry', {
      traceId: context.traceId,
      action: 'tool.scheduleSalesMeeting',
      metadata: { company: input.lead.company, tier: input.qualification.tier },
    });

    try {
      const meeting = await meetingsAdapter.scheduleMeeting(input.lead, input.qualification);

      logBusinessAction('exit', {
        traceId: context.traceId,
        action: 'tool.scheduleSalesMeeting',
        metadata: { meetingId: meeting.meetingId, scheduledAt: meeting.scheduledAt },
      });

      return meeting;
    } catch (error) {
      logBusinessAction('error', {
        traceId: context.traceId,
        action: 'tool.scheduleSalesMeeting',
        metadata: { error: String(error) },
      });
      throw error;
    }
  },
};
