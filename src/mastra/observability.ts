import { createLogger, format, transports } from 'winston';
import { randomUUID } from 'crypto';

const logger = createLogger({
  level: 'info',
  format: format.combine(format.timestamp(), format.json()),
  transports: [new transports.Console()],
});

export interface TraceLogContext {
  traceId: string;
  action: string;
  metadata?: Record<string, unknown>;
}

export const createTraceId = (): string => randomUUID();

export const logBusinessAction = (
  stage: 'entry' | 'exit' | 'error' | 'info',
  context: TraceLogContext
): void => {
  const logFn = stage === 'error' ? logger.error.bind(logger) : logger.info.bind(logger);
  logFn('[MastraAction]', {
    stage,
    traceId: context.traceId,
    action: context.action,
    ...context.metadata,
  });
};
