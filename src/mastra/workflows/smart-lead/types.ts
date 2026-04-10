import { EventEmitter } from 'events';
import { SalesLead, SalesQualificationResult } from '../../../types';

export type WorkflowStatus = 'running' | 'completed' | 'failed';

export interface WorkflowStepAudit {
  name: string;
  status: 'success' | 'failed' | 'skipped';
  startedAt: string;
  endedAt: string;
  durationMs: number;
  error?: string;
  metadata?: Record<string, unknown>;
}

export interface WorkflowExecution {
  executionId: string;
  workflowName: string;
  status: WorkflowStatus;
  input: SalesLead;
  startedAt: string;
  completedAt?: string;
  path: string[];
  steps: WorkflowStepAudit[];
  result?: SalesQualificationResult;
  error?: string;
  metrics: {
    durationMs: number;
    success: boolean;
    branch: 'HOT' | 'WARM' | 'COLD' | 'UNQUALIFIED';
  };
}

export interface WorkflowRuntime {
  executions: Map<string, WorkflowExecution>;
  emitter: EventEmitter;
}

export interface WorkflowActionContext {
  traceId: string;
  executionId: string;
  lead: SalesLead;
  qualification: SalesQualificationResult;
}
