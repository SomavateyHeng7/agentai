import { z } from 'zod';
import { zendeskAdapter } from '../../integrations/zendesk';
import { SupportTicketSchema, SupportTriageResultSchema } from '../../types';
import { ToolDefinition } from '../framework';
import { logBusinessAction } from '../observability';

const createZendeskTicketInputSchema = z.object({
  traceId: z.string().min(1),
  ticket: SupportTicketSchema,
  triage: SupportTriageResultSchema,
});

type CreateZendeskTicketInput = z.infer<typeof createZendeskTicketInputSchema>;

export interface CreateZendeskTicketOutput {
  ticketId: string;
  status: string;
  assigneeGroup: string;
}

export const createZendeskTicketTool: ToolDefinition<
  CreateZendeskTicketInput,
  CreateZendeskTicketOutput
> = {
  name: 'createZendeskTicket',
  description: 'Creates a Zendesk ticket from triage output and sends auto-response when required.',
  inputSchema: createZendeskTicketInputSchema,
  execute: async (input, context) => {
    logBusinessAction('entry', {
      traceId: context.traceId,
      action: 'tool.createZendeskTicket',
      metadata: { ticketId: input.ticket.id, priority: input.triage.priority },
    });

    try {
      const created = await zendeskAdapter.createTicket(input.ticket, input.triage);

      if (input.triage.shouldAutoRespond) {
        await zendeskAdapter.sendAutoResponse(created.ticketId, input.triage.autoResponse);
      }

      logBusinessAction('exit', {
        traceId: context.traceId,
        action: 'tool.createZendeskTicket',
        metadata: { createdTicketId: created.ticketId, assigneeGroup: created.assigneeGroup },
      });

      return {
        ticketId: created.ticketId,
        status: created.status,
        assigneeGroup: created.assigneeGroup,
      };
    } catch (error) {
      logBusinessAction('error', {
        traceId: context.traceId,
        action: 'tool.createZendeskTicket',
        metadata: { error: String(error) },
      });
      throw error;
    }
  },
};
