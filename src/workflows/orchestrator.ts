import { EventEmitter } from 'events';
import { SalesLeadSchema } from '../types';
import { executeSmartLeadWorkflow } from './definitions/smart-lead';
import { WorkflowExecution, WorkflowRuntime } from './types';

const runtime: WorkflowRuntime = {
  executions: new Map<string, WorkflowExecution>(),
  emitter: new EventEmitter(),
};

export const startSmartLeadWorkflow = async (input: unknown): Promise<WorkflowExecution> => {
  const parsed = SalesLeadSchema.safeParse(input);
  if (!parsed.success) {
    const details = parsed.error.errors.map((item) => `${item.path.join('.')}: ${item.message}`).join(', ');
    throw new Error(`Invalid workflow input: ${details}`);
  }

  return executeSmartLeadWorkflow(parsed.data, runtime);
};

export const getWorkflowExecution = (executionId: string): WorkflowExecution | null =>
  runtime.executions.get(executionId) || null;

export const getWorkflowExecutions = (): WorkflowExecution[] =>
  Array.from(runtime.executions.values()).sort(
    (a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
  );

export const subscribeWorkflowExecution = (
  executionId: string,
  callback: (execution: WorkflowExecution) => void
): (() => void) => {
  const listener = (execution: WorkflowExecution): void => {
    callback(execution);
  };

  runtime.emitter.on(executionId, listener);
  return () => {
    runtime.emitter.off(executionId, listener);
  };
};

export const getWorkflowPathMetrics = (): Record<
  string,
  { runs: number; success: number; successRate: number }
> => {
  const metrics: Record<string, { runs: number; success: number; successRate: number }> = {};

  for (const execution of runtime.executions.values()) {
    const pathKey = execution.path.length > 0 ? execution.path.join(' -> ') : 'unrouted';
    if (!metrics[pathKey]) {
      metrics[pathKey] = { runs: 0, success: 0, successRate: 0 };
    }

    metrics[pathKey].runs += 1;
    if (execution.status === 'completed') {
      metrics[pathKey].success += 1;
    }
  }

  for (const key of Object.keys(metrics)) {
    const item = metrics[key];
    item.successRate = item.runs === 0 ? 0 : Number(((item.success / item.runs) * 100).toFixed(2));
  }

  return metrics;
};
