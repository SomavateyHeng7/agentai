import { z } from 'zod';
import { WorkflowDefinition } from '../src/mastra/framework';
import { runOrchestration } from '../src/mastra/workflows/orchestration-runner';

const workflowInputSchema = z.object({
  traceId: z.string().min(1),
  company: z.string().min(1),
  contactEmail: z.string().email(),
});

type ExampleInput = z.infer<typeof workflowInputSchema>;

interface ExampleOutput {
  success: boolean;
  stage: string;
}

interface ExampleContext {
  traceId: string;
  company: string;
  contactEmail: string;
  stage: string;
}

// Example only: demonstrates how to compose required + optional orchestration steps.
export const exampleWorkflow: WorkflowDefinition<ExampleInput, ExampleOutput> = {
  name: 'example-orchestration-workflow',
  run: async (input) => {
    const parsed = workflowInputSchema.parse(input);

    const context: ExampleContext = {
      traceId: parsed.traceId,
      company: parsed.company,
      contactEmail: parsed.contactEmail,
      stage: 'received',
    };

    await runOrchestration({
      workflowName: 'example-orchestration-workflow',
      context,
      steps: [
        {
          name: 'validate-lead',
          run: async (ctx) => {
            if (!ctx.contactEmail.includes('@')) {
              throw new Error('Invalid email format.');
            }
            ctx.stage = 'validated';
          },
        },
        {
          name: 'optional-sync',
          optional: true,
          run: async (ctx) => {
            ctx.stage = 'synced';
          },
        },
      ],
    });

    return {
      success: true,
      stage: context.stage,
    };
  },
};
