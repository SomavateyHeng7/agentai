import { z } from 'zod';
import { contentGenerationPrompt } from '../../prompts';
import { ContentRequestSchema, ContentResult, ContentResultSchema } from '../../types';
import { ToolDefinition } from '../framework';
import { logBusinessAction } from '../observability';
import { loadPromptReference, runPromptedClaudeTool } from './tool-helpers';

const contentRequestInputSchema = ContentRequestSchema.extend({ traceId: z.string().min(1) });

type ContentGenerationInput = z.infer<typeof contentRequestInputSchema>;

export interface ContentGenerationOutput {
  result: ContentResult;
  tokensUsed: number;
  retryCount: number;
}

const promptReference = loadPromptReference('content-generator');

export const generateContentTool: ToolDefinition<ContentGenerationInput, ContentGenerationOutput> = {
  name: 'generateContent',
  description: 'Generates structured marketing content based on type, topic, tone, and audience.',
  inputSchema: contentRequestInputSchema,
  execute: async (input, context) => {
    logBusinessAction('entry', {
      traceId: context.traceId,
      action: 'tool.generateContent',
      metadata: { type: input.type, topic: input.topic },
    });

    try {
      const { system, user } = contentGenerationPrompt(input);
      const { result, tokensUsed, retryCount } = await runPromptedClaudeTool({
        system,
        user,
        promptVersion: 'content-generator/v1',
        promptReference,
        schema: ContentResultSchema,
        maxTokens: 1500,
        defaultError: 'Unknown content generation error',
      });

      logBusinessAction('exit', {
        traceId: context.traceId,
        action: 'tool.generateContent',
        metadata: { wordCount: result.wordCount, retryCount },
      });

      return { result, tokensUsed, retryCount };
    } catch (error) {
      logBusinessAction('error', {
        traceId: context.traceId,
        action: 'tool.generateContent',
        metadata: { error: String(error) },
      });
      throw error;
    }
  },
};
