export interface VariantExecutionMetrics {
  durationMs: number;
  tokensUsed: number;
  success: boolean;
  validationPassed: boolean;
}

export interface VariantAggregate {
  sampleSize: number;
  successRate: number;
  validationFailureRate: number;
  avgDurationMs: number;
  avgTokensUsed: number;
  estimatedCostUsd: number;
}

export interface VariantComparison {
  zScore: number;
  confidence95: boolean;
  winner: 'A' | 'B' | 'tie';
}

const mean = (values: number[]): number =>
  values.length === 0 ? 0 : values.reduce((sum, value) => sum + value, 0) / values.length;

const proportionZScore = (p1: number, n1: number, p2: number, n2: number): number => {
  if (n1 === 0 || n2 === 0) {
    return 0;
  }

  const pooled = (p1 * n1 + p2 * n2) / (n1 + n2);
  const standardError = Math.sqrt(pooled * (1 - pooled) * (1 / n1 + 1 / n2));
  if (standardError === 0) {
    return 0;
  }

  return (p1 - p2) / standardError;
};

export const aggregateVariantMetrics = (
  executions: VariantExecutionMetrics[],
  usdPerThousandTokens = 0.003
): VariantAggregate => {
  const sampleSize = executions.length;
  const successes = executions.filter((item) => item.success).length;
  const validationFailures = executions.filter((item) => !item.validationPassed).length;

  const avgTokensUsed = mean(executions.map((item) => item.tokensUsed));

  return {
    sampleSize,
    successRate: sampleSize === 0 ? 0 : Number(((successes / sampleSize) * 100).toFixed(2)),
    validationFailureRate:
      sampleSize === 0 ? 0 : Number(((validationFailures / sampleSize) * 100).toFixed(2)),
    avgDurationMs: Math.round(mean(executions.map((item) => item.durationMs))),
    avgTokensUsed: Math.round(avgTokensUsed),
    estimatedCostUsd: Number(((avgTokensUsed * sampleSize * usdPerThousandTokens) / 1000).toFixed(4)),
  };
};

export const compareVariants = (a: VariantAggregate, b: VariantAggregate): VariantComparison => {
  const zScore = proportionZScore(a.successRate / 100, a.sampleSize, b.successRate / 100, b.sampleSize);
  const confidence95 = Math.abs(zScore) >= 1.96;

  if (!confidence95) {
    return { zScore: Number(zScore.toFixed(3)), confidence95: false, winner: 'tie' };
  }

  if (a.successRate > b.successRate) {
    return { zScore: Number(zScore.toFixed(3)), confidence95: true, winner: 'A' };
  }

  if (b.successRate > a.successRate) {
    return { zScore: Number(zScore.toFixed(3)), confidence95: true, winner: 'B' };
  }

  return { zScore: Number(zScore.toFixed(3)), confidence95: true, winner: 'tie' };
};
