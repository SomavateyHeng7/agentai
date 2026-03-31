import { createLogger, format, transports } from 'winston';
import { WorkflowActionContext } from '../types';
import { withRetry } from './retry';

const logger = createLogger({
  level: 'info',
  format: format.combine(format.timestamp(), format.json()),
  transports: [new transports.Console()],
});

export interface EmailActionInput {
  to: string;
  subject: string;
  body: string;
}

export const sendEmailAction = async (
  input: EmailActionInput,
  context: WorkflowActionContext
): Promise<void> => {
  await withRetry(async () => {
    logger.info('[WorkflowAction] send_email', {
      executionId: context.executionId,
      traceId: context.traceId,
      to: input.to,
      subject: input.subject,
    });
  });
};
