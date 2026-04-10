import { createLogger, format, transports } from 'winston';
import { ApiResponse, ContentRequestSchema, ContentResult } from '../../types';
import { BaseAgent } from './base-agent';

const logger = createLogger({
  level: 'info',
  format: format.combine(format.timestamp(), format.json()),
  transports: [new transports.Console()],
});

export class ContentGenerator extends BaseAgent {
  async generate(input: unknown): Promise<ApiResponse<ContentResult>> {
    return this.executeValidated({
      input,
      schema: ContentRequestSchema,
      workflowName: 'content-generation-workflow',
      logger,
      logLabel: 'ContentGenerator',
      metadata: (parsed) => ({
        type: parsed.type,
        topic: parsed.topic,
      }),
    });
  }
}

export const contentGenerator = new ContentGenerator();
