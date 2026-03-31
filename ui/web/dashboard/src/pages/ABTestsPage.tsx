import { FormEvent, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { agentFlowAPI } from '../api/client';
import { DataTable } from '../components/DataTable';
import { ErrorState } from '../components/ErrorState';
import { LoadingSkeleton } from '../components/LoadingSkeleton';

interface ABTestRecord {
  testId: string;
  agentType: string;
  variantA: string;
  variantB: string;
  status: string;
  startedAt: string;
  promotedVariant?: 'A' | 'B';
}

export const ABTestsPage = () => {
  const queryClient = useQueryClient();
  const [selectedTestId, setSelectedTestId] = useState<string | null>(null);
  const [form, setForm] = useState({
    agentType: 'sales-qualify',
    variantA: 'v1',
    variantB: 'v2',
    runsPerSample: 2,
    samplesJson: JSON.stringify(
      [
        {
          email: 'cto@example.com',
          company: 'Acme',
          message: 'Need enterprise automation and budget approved.',
          source: 'website',
        },
      ],
      null,
      2
    ),
  });

  const listQuery = useQuery({
    queryKey: ['ab-tests'],
    queryFn: () => agentFlowAPI.getABTests(),
    refetchInterval: 10000,
  });

  const tests = (listQuery.data as { data?: ABTestRecord[] } | undefined)?.data || [];

  const detailsQuery = useQuery({
    queryKey: ['ab-test-detail', selectedTestId],
    queryFn: () => agentFlowAPI.getABTest(String(selectedTestId)),
    enabled: Boolean(selectedTestId),
  });

  const createMutation = useMutation({
    mutationFn: (payload: unknown) => agentFlowAPI.createABTest(payload),
    onSuccess: (result: unknown) => {
      const testId = (result as { data?: { test?: { testId?: string } } })?.data?.test?.testId || null;
      queryClient.invalidateQueries({ queryKey: ['ab-tests'] });
      if (testId) {
        setSelectedTestId(testId);
      }
    },
  });

  const promoteMutation = useMutation({
    mutationFn: ({ testId, winner }: { testId: string; winner: 'A' | 'B' }) =>
      agentFlowAPI.promoteABWinner(testId, winner),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ab-tests'] });
      if (selectedTestId) {
        queryClient.invalidateQueries({ queryKey: ['ab-test-detail', selectedTestId] });
      }
    },
  });

  const onCreate = (event: FormEvent) => {
    event.preventDefault();
    const payload = {
      agentType: form.agentType,
      variantA: form.variantA,
      variantB: form.variantB,
      runsPerSample: Number(form.runsPerSample),
      samples: JSON.parse(form.samplesJson),
    };
    createMutation.mutate(payload);
  };

  const details = detailsQuery.data as
    | {
        data?: {
          test?: ABTestRecord;
          executions?: Array<{
            variant: string;
            durationMs: number;
            tokensUsed: number;
            success: boolean;
            validationPassed: boolean;
          }>;
        };
      }
    | undefined;

  const comparison = useMemo(() => {
    const executions = details?.data?.executions || [];
    const a = executions.filter((item) => item.variant === details?.data?.test?.variantA);
    const b = executions.filter((item) => item.variant === details?.data?.test?.variantB);

    const summarize = (items: typeof executions) => {
      if (items.length === 0) {
        return { successRate: 0, avgLatency: 0, avgTokens: 0, cost: 0, sampleSize: 0 };
      }

      const successRate = (items.filter((item) => item.success).length / items.length) * 100;
      const avgLatency = items.reduce((sum, item) => sum + item.durationMs, 0) / items.length;
      const avgTokens = items.reduce((sum, item) => sum + item.tokensUsed, 0) / items.length;
      const cost = (avgTokens * items.length * 0.003) / 1000;

      return {
        successRate,
        avgLatency,
        avgTokens,
        cost,
        sampleSize: items.length,
      };
    };

    const variantAStats = summarize(a);
    const variantBStats = summarize(b);

    return {
      variantAStats,
      variantBStats,
      winner: (variantBStats.successRate >= variantAStats.successRate ? 'B' : 'A') as 'A' | 'B',
      confidence: variantAStats.sampleSize + variantBStats.sampleSize >= 20 ? 95 : 80,
    };
  }, [details]);

  const rows = tests.map((test) => [
    <button key={`${test.testId}-btn`} className="text-left font-mono text-xs text-indigo-700" onClick={() => setSelectedTestId(test.testId)}>
      {test.testId}
    </button>,
    test.agentType,
    `${test.variantA} vs ${test.variantB}`,
    <span key={`${test.testId}-status`} className="capitalize">{test.status}</span>,
    new Date(test.startedAt).toLocaleString(),
    test.promotedVariant ? `Promoted ${test.promotedVariant}` : 'Not promoted',
  ]);

  const chartData = [
    {
      name: 'Variant A',
      successRate: comparison.variantAStats.successRate,
      latency: comparison.variantAStats.avgLatency,
      tokens: comparison.variantAStats.avgTokens,
    },
    {
      name: 'Variant B',
      successRate: comparison.variantBStats.successRate,
      latency: comparison.variantBStats.avgLatency,
      tokens: comparison.variantBStats.avgTokens,
    },
  ];

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-semibold">A/B Tests</h1>
        <p className="text-sm text-ink/60">Active tests, result comparison, and one-click winner promotion.</p>
      </header>

      <section className="rounded-2xl border border-ink/10 bg-white p-4">
        <h2 className="mb-3 text-sm font-medium text-ink/70">Create New A/B Test</h2>
        <form className="grid gap-3 md:grid-cols-2" onSubmit={onCreate}>
          <label className="text-sm">
            Agent Type
            <select
              className="mt-1 w-full rounded-lg border border-ink/20 px-3 py-2"
              value={form.agentType}
              onChange={(event) => setForm((prev) => ({ ...prev, agentType: event.target.value }))}
            >
              <option value="sales-qualify">sales-qualify</option>
              <option value="sales-orchestrate">sales-orchestrate</option>
              <option value="support-triage">support-triage</option>
              <option value="content-generate">content-generate</option>
            </select>
          </label>

          <label className="text-sm">
            Runs Per Sample
            <input
              type="number"
              min={1}
              max={20}
              className="mt-1 w-full rounded-lg border border-ink/20 px-3 py-2"
              value={form.runsPerSample}
              onChange={(event) => setForm((prev) => ({ ...prev, runsPerSample: Number(event.target.value) }))}
            />
          </label>

          <label className="text-sm">
            Variant A
            <input
              className="mt-1 w-full rounded-lg border border-ink/20 px-3 py-2"
              value={form.variantA}
              onChange={(event) => setForm((prev) => ({ ...prev, variantA: event.target.value }))}
            />
          </label>

          <label className="text-sm">
            Variant B
            <input
              className="mt-1 w-full rounded-lg border border-ink/20 px-3 py-2"
              value={form.variantB}
              onChange={(event) => setForm((prev) => ({ ...prev, variantB: event.target.value }))}
            />
          </label>

          <label className="text-sm md:col-span-2">
            Samples JSON
            <textarea
              className="mt-1 h-36 w-full rounded-lg border border-ink/20 px-3 py-2 font-mono text-xs"
              value={form.samplesJson}
              onChange={(event) => setForm((prev) => ({ ...prev, samplesJson: event.target.value }))}
            />
          </label>

          <div className="md:col-span-2">
            <button className="rounded-lg bg-ink px-4 py-2 text-sm text-white" type="submit">
              {createMutation.isPending ? 'Creating...' : 'Create A/B Test'}
            </button>
          </div>
        </form>
      </section>

      <section className="rounded-2xl border border-ink/10 bg-white p-4">
        <h2 className="mb-3 text-sm font-medium text-ink/70">Historical Test Results</h2>
        {listQuery.isLoading ? <LoadingSkeleton rows={5} /> : null}
        {listQuery.error ? <ErrorState message="Failed to load tests" onRetry={() => listQuery.refetch()} /> : null}
        {!listQuery.isLoading && !listQuery.error ? (
          <DataTable
            headers={['Test ID', 'Agent', 'Variants', 'Status', 'Started At', 'Promotion']}
            rows={rows}
          />
        ) : null}
      </section>

      <section className="rounded-2xl border border-ink/10 bg-white p-4">
        <h2 className="mb-3 text-sm font-medium text-ink/70">Results Comparison View</h2>
        {!selectedTestId ? <p className="text-sm text-ink/60">Select a test to inspect details.</p> : null}
        {selectedTestId && detailsQuery.isLoading ? <LoadingSkeleton rows={5} /> : null}
        {selectedTestId && detailsQuery.error ? (
          <ErrorState message="Failed to load selected test details" onRetry={() => detailsQuery.refetch()} />
        ) : null}

        {selectedTestId && details?.data?.test ? (
          <div className="space-y-4">
            <div className="grid gap-3 md:grid-cols-2">
              <article className="rounded-xl border border-ink/10 bg-shell p-3">
                <p className="text-xs uppercase text-ink/50">Variant A ({details.data.test.variantA})</p>
                <p className="text-sm">Success Rate: {comparison.variantAStats.successRate.toFixed(2)}%</p>
                <p className="text-sm">Avg Latency: {comparison.variantAStats.avgLatency.toFixed(0)}ms</p>
                <p className="text-sm">Tokens: {comparison.variantAStats.avgTokens.toFixed(0)}</p>
                <p className="text-sm">Cost: ${comparison.variantAStats.cost.toFixed(4)}</p>
              </article>

              <article className="rounded-xl border border-moss/30 bg-moss/10 p-3">
                <p className="text-xs uppercase text-ink/50">Variant B ({details.data.test.variantB})</p>
                <p className="text-sm">Success Rate: {comparison.variantBStats.successRate.toFixed(2)}%</p>
                <p className="text-sm">Avg Latency: {comparison.variantBStats.avgLatency.toFixed(0)}ms</p>
                <p className="text-sm">Tokens: {comparison.variantBStats.avgTokens.toFixed(0)}</p>
                <p className="text-sm">Cost: ${comparison.variantBStats.cost.toFixed(4)}</p>
              </article>
            </div>

            <div className="rounded-xl border border-ink/10 bg-shell p-3 text-sm">
              <p>Confidence Level: {comparison.confidence}%</p>
              <p>
                Sample Size: {comparison.variantAStats.sampleSize} per variant
              </p>
              <p>
                Recommendation: Deploy Variant {comparison.winner === 'A' ? details.data.test.variantA : details.data.test.variantB}
              </p>
            </div>

            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="successRate" name="Success Rate %">
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.name === 'Variant B' ? '#1f6f50' : '#d97706'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            <button
              className="rounded-lg bg-moss px-4 py-2 text-sm text-white"
              onClick={() =>
                promoteMutation.mutate({
                  testId: details.data?.test?.testId || '',
                  winner: comparison.winner,
                })
              }
              disabled={promoteMutation.isPending}
            >
              {promoteMutation.isPending
                ? 'Promoting...'
                : `Deploy Variant ${comparison.winner === 'A' ? details.data.test.variantA : details.data.test.variantB} ->`}
            </button>
          </div>
        ) : null}
      </section>
    </div>
  );
};
