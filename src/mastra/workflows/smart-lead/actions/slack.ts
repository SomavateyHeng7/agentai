import { createLogger, format, transports } from 'winston';
import { WorkflowActionContext } from '../types';
import { withRetry } from './retry';

const logger = createLogger({
  level: 'info',
  format: format.combine(format.timestamp(), format.json()),
  transports: [new transports.Console()],
});

export interface SlackActionInput {
  channel: string;
  message: string;
}

export const sendSlackAction = async (
  input: SlackActionInput,
  context: WorkflowActionContext
): Promise<void> => {
  await withRetry(async () => {
    logger.info('[WorkflowAction] send_slack', {
      executionId: context.executionId,
      traceId: context.traceId,
      channel: input.channel,
      message: input.message,
    });
  });
};
