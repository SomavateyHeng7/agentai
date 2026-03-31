export interface DashboardStat {
  totalExecutions: number;
  successRate: number;
  avgDurationMs: number;
  avgTokensUsed: number;
  avgRetryCount: number;
  validationPassRate: number;
}

export interface MetricRecord {
  id: string;
  agentName: string;
  durationMs: number;
  tokensUsed: number;
  success: boolean;
  validationPassed: boolean;
  retryCount: number;
  timestamp: string;
}

export interface WorkflowExecution {
  executionId: string;
  workflowName: string;
  status: 'running' | 'completed' | 'failed';
  startedAt: string;
  completedAt?: string;
  path: string[];
  error?: string;
}

export interface AgentCardData {
  id: string;
  name: string;
  successRate: number;
  avgLatencyMs: number;
  status: 'active' | 'paused' | 'error';
  executions: number;
}
