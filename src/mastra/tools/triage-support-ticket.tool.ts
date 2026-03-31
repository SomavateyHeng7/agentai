import { z } from 'zod';
import { supportTriagePrompt } from '../../prompts';
import { SupportTicketSchema, SupportTriageResult, SupportTriageResultSchema } from '../../types';
import { ToolDefinition } from '../framework';
import { logBusinessAction } from '../observability';
import { loadPromptReference, runPromptedClaudeTool } from './tool-helpers';

const supportTicketInputSchema = SupportTicketSchema.extend({ traceId: z.string().min(1) });

type SupportTicketToolInput = z.infer<typeof supportTicketInputSchema>;

export interface SupportTicketTriageOutput {
  result: SupportTriageResult;
  tokensUsed: number;
  retryCount: number;
}

const promptReference = loadPromptReference('support-triage');

export const triageSupportTicketTool: ToolDefinition<SupportTicketToolInput, SupportTicketTriageOutput> = {
  name: 'triageSupportTicket',
  description: 'Classifies support ticket priority and team routing with optional auto-response.',
  inputSchema: supportTicketInputSchema,
  execute: async (input, context) => {
    logBusinessAction('entry', {
      traceId: context.traceId,
      action: 'tool.triageSupportTicket',
      metadata: { ticketId: input.id, subject: input.subject },
    });

    try {
      const { system, user } = supportTriagePrompt(input);
      const { result, tokensUsed, retryCount } = await runPromptedClaudeTool({
        system,
        user,
        promptVersion: 'support-triage/v1',
        promptReference,
        schema: SupportTriageResultSchema,
        maxTokens: 1024,
        defaultError: 'Unknown support triage error',
      });

      logBusinessAction('exit', {
        traceId: context.traceId,
        action: 'tool.triageSupportTicket',
        metadata: { priority: result.priority, team: result.team, retryCount },
      });

      return { result, tokensUsed, retryCount };
    } catch (error) {
      logBusinessAction('error', {
        traceId: context.traceId,
        action: 'tool.triageSupportTicket',
        metadata: { error: String(error) },
      });
      throw error;
    }
  },
};
