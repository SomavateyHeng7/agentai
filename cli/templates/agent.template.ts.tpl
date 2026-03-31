import { createLogger, format, transports } from 'winston';
import { ApiResponse } from '../types';

const logger = createLogger({
  level: 'info',
  format: format.combine(format.timestamp(), format.json()),
  transports: [new transports.Console()],
});

interface {{AgentTypeName}}Input {
  traceId?: string;
}

interface {{AgentTypeName}}Result {
  message: string;
}

export class {{AgentClassName}} {
  async run(input: {{AgentTypeName}}Input): Promise<ApiResponse<{{AgentTypeName}}Result>> {
    logger.info('[{{AgentClassName}}] run', { traceId: input.traceId || 'n/a' });

    return {
      success: true,
      data: {
        message: '{{AgentClassName}} executed successfully.',
      },
      meta: {
        durationMs: 0,
        tokensUsed: 0,
        retryCount: 0,
        agentVersion: 'v1',
      },
    };
  }
}

export const {{agentVarName}} = new {{AgentClassName}}();
