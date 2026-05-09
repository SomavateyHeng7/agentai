import { readFileSync } from 'fs';
import { join } from 'path';
import { z } from 'zod';
import { ClaudeRunResult, LLMParams, getModel, runWithRetry } from '../utils/claude-runner';

export const loadPromptReference = (agentFolder: string, version = 'v1'): string => {
  try {
    return readFileSync(join(__dirname, '..', 'prompts', agentFolder, `${version}.md`), 'utf8');
  } catch {
    return 'Prompt reference unavailable at runtime.';
  }
};

interface RunPromptedToolOptions<T> {
  system: string;
  user: string;
  promptVersion: string;
  promptReference: string;
  schema: z.ZodType<T>;
  maxTokens: number;
  defaultError: string;
}

export const runPromptedClaudeTool = async <T>(
  options: RunPromptedToolOptions<T>
): Promise<ClaudeRunResult<T>> => {
  const params: LLMParams = {
    model: getModel(),
    max_tokens: options.maxTokens,
    system: `${options.system}\n\nPromptVersion: ${options.promptVersion}\n${options.promptReference}`,
    messages: [{ role: 'user', content: options.user }],
  };
  return runWithRetry(params, options.schema, options.defaultError);
};