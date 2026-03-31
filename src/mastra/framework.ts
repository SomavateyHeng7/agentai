import { z } from 'zod';

export interface ToolContext {
  traceId: string;
}

export interface ToolDefinition<TInput, TOutput> {
  name: string;
  description: string;
  inputSchema: z.ZodType<TInput>;
  execute: (input: TInput, context: ToolContext) => Promise<TOutput>;
}

export interface WorkflowDefinition<TInput, TOutput> {
  name: string;
  run: (input: TInput, context: ToolContext) => Promise<TOutput>;
}

export class Mastra {
  private readonly workflows = new Map<string, WorkflowDefinition<unknown, unknown>>();

  registerWorkflow = <TInput, TOutput>(workflow: WorkflowDefinition<TInput, TOutput>): void => {
    this.workflows.set(workflow.name, workflow as WorkflowDefinition<unknown, unknown>);
  };

  getWorkflow = <TInput, TOutput>(name: string): WorkflowDefinition<TInput, TOutput> => {
    const workflow = this.workflows.get(name);
    if (!workflow) {
      throw new Error(`Workflow not found: ${name}`);
    }
    return workflow as WorkflowDefinition<TInput, TOutput>;
  };
}
