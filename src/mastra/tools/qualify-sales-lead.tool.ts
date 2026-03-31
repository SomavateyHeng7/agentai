import { z } from 'zod';
import { salesQualificationPrompt } from '../../prompts';
import { SalesLeadSchema, SalesQualificationResult, SalesQualificationResultSchema } from '../../types';
import { ToolDefinition } from '../framework';
import { logBusinessAction } from '../observability';
import { loadPromptReference, runPromptedClaudeTool } from './tool-helpers';

const salesLeadInputSchema = SalesLeadSchema.extend({ traceId: z.string().min(1) });

type SalesLeadToolInput = z.infer<typeof salesLeadInputSchema>;

export interface SalesLeadQualificationOutput {
  result: SalesQualificationResult;
  tokensUsed: number;
  retryCount: number;
}

const promptReference = loadPromptReference('sales-qualifier');

export const qualifySalesLeadTool: ToolDefinition<SalesLeadToolInput, SalesLeadQualificationOutput> = {
  name: 'qualifySalesLead',
  description: 'Qualifies a sales lead using BANT and intent signals and returns a structured score and recommended next action.',
  inputSchema: salesLeadInputSchema,
  execute: async (input, context) => {
    logBusinessAction('entry', {
      traceId: context.traceId,
      action: 'tool.qualifySalesLead',
      metadata: { company: input.company, source: input.source },
    });

    try {
      const { system, user } = salesQualificationPrompt(input);
      const { result, tokensUsed, retryCount } = await runPromptedClaudeTool({
        system,
        user,
        promptVersion: 'sales-qualifier/v1',
        promptReference,
        schema: SalesQualificationResultSchema,
        maxTokens: 1024,
        defaultError: 'Unknown qualification error',
      });

      logBusinessAction('exit', {
        traceId: context.traceId,
        action: 'tool.qualifySalesLead',
        metadata: { score: result.score, tier: result.tier, retryCount },
      });

      return { result, tokensUsed, retryCount };
    } catch (error) {
      logBusinessAction('error', {
        traceId: context.traceId,
        action: 'tool.qualifySalesLead',
        metadata: { error: String(error) },
      });
      throw error;
    }
  },
};
