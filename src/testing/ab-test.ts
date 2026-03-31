import { randomUUID } from 'crypto';
import { z } from 'zod';
import { runWorkflow } from '../cli/workflow-runner';
import { compareVariants, aggregateVariantMetrics, VariantExecutionMetrics } from './metrics-collector';

const abTestConfigSchema = z.object({
  agentType: z.enum(['sales-qualify', 'sales-orchestrate', 'support-triage', 'content-generate']),
  variantA: z.string().min(1),
  variantB: z.string().min(1),
  samples: z.array(z.unknown()).min(1),
  runsPerSample: z.number().int().positive().max(20).default(1),
});

export interface ABTestExecutionRecord {
  id: string;
  testId: string;
  variant: string;
  inputData: unknown;
  outputData: unknown;
  durationMs: number;
  tokensUsed: number;
  success: boolean;
  validationPassed: boolean;
  createdAt: string;
}

export interface ABTestRecord {
  id: string;
  testId: string;
  agentType: string;
  variantA: string;
  variantB: string;
  status: 'running' | 'completed' | 'failed';
  startedAt: string;
  completedAt?: string;
  promotedVariant?: 'A' | 'B';
  promotedAt?: string;
}

const abTests: ABTestRecord[] = [];
const abExecutions: ABTestExecutionRecord[] = [];

const toExecutionMetrics = (output: unknown): VariantExecutionMetrics => {
  if (!output || typeof output !== 'object') {
    return {
      durationMs: 0,
      tokensUsed: 0,
      success: false,
      validationPassed: false,
    };
  }

  const result = output as {
    success?: unknown;
    meta?: { durationMs?: unknown; tokensUsed?: unknown };
  };

  const durationMs = typeof result.meta?.durationMs === 'number' ? result.meta.durationMs : 0;
  const tokensUsed = typeof result.meta?.tokensUsed === 'number' ? result.meta.tokensUsed : 0;
  const success = Boolean(result.success);

  return {
    durationMs,
    tokensUsed,
    success,
    validationPassed: success,
  };
};

export const startABTest = async (configInput: unknown): Promise<{
  test: ABTestRecord;
  summary: {
    variantA: ReturnType<typeof aggregateVariantMetrics>;
    variantB: ReturnType<typeof aggregateVariantMetrics>;
    comparison: ReturnType<typeof compareVariants>;
  };
}> => {
  const parsed = abTestConfigSchema.safeParse(configInput);
  if (!parsed.success) {
    const details = parsed.error.errors.map((item) => `${item.path.join('.')}: ${item.message}`).join(', ');
    throw new Error(`Invalid AB test payload: ${details}`);
  }

  const config = parsed.data;
  const test: ABTestRecord = {
    id: randomUUID(),
    testId: `ab_${Date.now()}`,
    agentType: config.agentType,
    variantA: config.variantA,
    variantB: config.variantB,
    status: 'running',
    startedAt: new Date().toISOString(),
  };
  abTests.push(test);

  try {
    const aMetrics: VariantExecutionMetrics[] = [];
    const bMetrics: VariantExecutionMetrics[] = [];

    for (let i = 0; i < config.samples.length; i += 1) {
      for (let r = 0; r < config.runsPerSample; r += 1) {
        const sample = config.samples[i];

        const aStart = Date.now();
        const aOutput = await runWorkflow(config.agentType, sample);
        const aEval = toExecutionMetrics(aOutput);
        aMetrics.push(aEval);
        abExecutions.push({
          id: randomUUID(),
          testId: test.testId,
          variant: config.variantA,
          inputData: sample,
          outputData: aOutput,
          durationMs: aEval.durationMs || Date.now() - aStart,
          tokensUsed: aEval.tokensUsed,
          success: aEval.success,
          validationPassed: aEval.validationPassed,
          createdAt: new Date().toISOString(),
        });

        const bStart = Date.now();
        const bOutput = await runWorkflow(config.agentType, sample);
        const bEval = toExecutionMetrics(bOutput);
        bMetrics.push(bEval);
        abExecutions.push({
          id: randomUUID(),
          testId: test.testId,
          variant: config.variantB,
          inputData: sample,
          outputData: bOutput,
          durationMs: bEval.durationMs || Date.now() - bStart,
          tokensUsed: bEval.tokensUsed,
          success: bEval.success,
          validationPassed: bEval.validationPassed,
          createdAt: new Date().toISOString(),
        });
      }
    }

    test.status = 'completed';
    test.completedAt = new Date().toISOString();

    const variantA = aggregateVariantMetrics(aMetrics);
    const variantB = aggregateVariantMetrics(bMetrics);
    const comparison = compareVariants(variantA, variantB);

    return {
      test,
      summary: {
        variantA,
        variantB,
        comparison,
      },
    };
  } catch (error) {
    test.status = 'failed';
    test.completedAt = new Date().toISOString();
    throw error;
  }
};

export const listABTests = (): ABTestRecord[] => [...abTests].sort((a, b) => b.startedAt.localeCompare(a.startedAt));

export const getABTestById = (testId: string): ABTestRecord | null =>
  abTests.find((item) => item.testId === testId) || null;

export const getABExecutionsByTestId = (testId: string): ABTestExecutionRecord[] =>
  abExecutions.filter((item) => item.testId === testId);

export const promoteABTestWinner = (testId: string, winner: 'A' | 'B'): ABTestRecord | null => {
  const record = getABTestById(testId);
  if (!record) {
    return null;
  }

  record.promotedVariant = winner;
  record.promotedAt = new Date().toISOString();
  return record;
};
