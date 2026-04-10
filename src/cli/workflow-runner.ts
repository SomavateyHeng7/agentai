export type WorkflowName =
  | 'sales-orchestrate'
  | 'sales-qualify'
  | 'support-triage'
  | 'content-generate';

export const WORKFLOW_NAMES: WorkflowName[] = [
  'sales-orchestrate',
  'sales-qualify',
  'support-triage',
  'content-generate',
];

export const isWorkflowName = (value: string): value is WorkflowName =>
  WORKFLOW_NAMES.includes(value as WorkflowName);

export const runWorkflow = async (workflow: WorkflowName, payload: unknown): Promise<unknown> => {
  switch (workflow) {
    case 'sales-orchestrate': {
      const { salesOrchestrator } = await import('../mastra/agents/sales-orchestrator');
      return salesOrchestrator.orchestrate(payload);
    }
    case 'sales-qualify': {
      const { salesQualifier } = await import('../mastra/agents/sales-qualifier');
      return salesQualifier.qualify(payload);
    }
    case 'support-triage': {
      const { supportTriage } = await import('../mastra/agents/support-triage');
      return supportTriage.triage(payload);
    }
    case 'content-generate': {
      const { contentGenerator } = await import('../mastra/agents/content-generator');
      return contentGenerator.generate(payload);
    }
    default:
      throw new Error(`Unsupported workflow: ${workflow}`);
  }
};
