export interface OrchestrationStepResult {
  name: string;
  success: boolean;
  durationMs: number;
  error?: string;
  skipped?: boolean;
}

export interface OrchestrationStep<TContext> {
  name: string;
  optional?: boolean;
  skip?: (context: TContext) => boolean;
  run: (context: TContext) => Promise<void>;
}

export interface RunOrchestrationInput<TContext> {
  workflowName: string;
  context: TContext;
  steps: Array<OrchestrationStep<TContext>>;
}

export interface RunOrchestrationResult<TContext> {
  context: TContext;
  stepResults: OrchestrationStepResult[];
}

export const runOrchestration = async <TContext>(
  input: RunOrchestrationInput<TContext>
): Promise<RunOrchestrationResult<TContext>> => {
  const stepResults: OrchestrationStepResult[] = [];

  // Execute steps sequentially so each step can safely depend on previous outputs.
  for (const step of input.steps) {
    if (step.skip?.(input.context)) {
      stepResults.push({
        name: step.name,
        success: true,
        skipped: true,
        durationMs: 0,
      });
      continue;
    }

    const startedAt = Date.now();

    try {
      await step.run(input.context);
      stepResults.push({
        name: step.name,
        success: true,
        durationMs: Date.now() - startedAt,
      });
    } catch (error) {
      const stepResult: OrchestrationStepResult = {
        name: step.name,
        success: false,
        durationMs: Date.now() - startedAt,
        error: String(error),
      };
      stepResults.push(stepResult);

      // Optional steps are recorded and execution continues; required steps fail fast.
      if (!step.optional) {
        throw new Error(
          `[${input.workflowName}] Step failed: ${step.name}. Error: ${stepResult.error}`
        );
      }
    }
  }

  return {
    context: input.context,
    stepResults,
  };
};
