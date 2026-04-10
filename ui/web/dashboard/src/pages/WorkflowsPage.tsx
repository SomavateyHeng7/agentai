import { FormEvent, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, CircleAlert, Loader2, Play, RadioTower, Route } from 'lucide-react';
import { executeWorkflow, fetchPathMetrics, fetchWorkflowExecutions } from '../lib/api';

const workflowPayloadTemplate = {
  email: 'cto@example.com',
  company: 'Acme Corp',
  message: 'Need enterprise automation and budget is approved this quarter.',
  source: 'website',
};

export const WorkflowsPage = () => {
  const [payloadText, setPayloadText] = useState(JSON.stringify(workflowPayloadTemplate, null, 2));
  const [executionId, setExecutionId] = useState<string | null>(null);
  const [streamEvents, setStreamEvents] = useState<string[]>([]);
  const [payloadError, setPayloadError] = useState<string | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);

  const { data: executionsData, refetch } = useQuery({
    queryKey: ['workflows-executions'],
    queryFn: fetchWorkflowExecutions,
    refetchInterval: 5000,
  });

  const { data: pathMetricsData } = useQuery({
    queryKey: ['workflow-path-metrics'],
    queryFn: fetchPathMetrics,
    refetchInterval: 5000,
  });

  const executions = executionsData?.data || [];
  const pathMetrics = pathMetricsData?.data || {};

  const pathRows = useMemo(() => {
    return Object.entries(pathMetrics)
      .map(([path, values]) => ({
        path,
        runs: (values as { runs: number }).runs,
        success: (values as { success: number }).success,
      }))
      .sort((a, b) => b.runs - a.runs);
  }, [pathMetrics]);

  const totalRuns = useMemo(() => pathRows.reduce((sum, row) => sum + row.runs, 0), [pathRows]);

  const successRate = useMemo(() => {
    if (totalRuns === 0) {
      return 0;
    }

    const totalSuccess = pathRows.reduce((sum, row) => sum + row.success, 0);
    return Number(((totalSuccess / totalRuns) * 100).toFixed(1));
  }, [pathRows, totalRuns]);

  const startStream = (id: string) => {
    const eventSource = new EventSource(`http://localhost:3000/api/workflows/stream/${id}`);
    setExecutionId(id);
    setStreamEvents([]);

    eventSource.onmessage = (event) => {
      setStreamEvents((previous) => [event.data, ...previous].slice(0, 12));
      try {
        const parsed = JSON.parse(event.data);
        if (parsed?.data?.status && parsed.data.status !== 'running') {
          eventSource.close();
          refetch();
        }
      } catch {
        // Ignore malformed stream chunks.
      }
    };

    eventSource.onerror = () => {
      eventSource.close();
      setStreamEvents((previous) => ['Connection lost. Stream closed.', ...previous].slice(0, 16));
    };
  };

  const onExecute = async (event: FormEvent) => {
    event.preventDefault();
    setPayloadError(null);
    setIsExecuting(true);

    try {
      const payload = JSON.parse(payloadText);
      const response = await executeWorkflow(payload);
      if (response?.data?.executionId) {
        startStream(response.data.executionId);
      }
    } catch (error) {
      setPayloadError(error instanceof Error ? error.message : String(error));
    } finally {
      setIsExecuting(false);
    }
  };

  const setSamplePayload = (variant: 'hot' | 'warm' | 'cold') => {
    const byVariant = {
      hot: {
        email: 'vp.sales@globex.com',
        company: 'Globex',
        message: 'We need an enterprise rollout this month and procurement is already approved.',
        source: 'demo-request',
      },
      warm: {
        email: 'ops@northwind.io',
        company: 'Northwind',
        message: 'Exploring options for workflow automation in Q3. Looking for implementation details.',
        source: 'webinar',
      },
      cold: {
        email: 'founder@earlyidea.dev',
        company: 'EarlyIdea',
        message: 'Curious about features. No timeline yet.',
        source: 'newsletter',
      },
    };

    setPayloadText(JSON.stringify(byVariant[variant], null, 2));
    setPayloadError(null);
  };

  const getStatusClasses = (status: string): string => {
    if (status === 'completed') {
      return 'bg-emerald-100 text-emerald-800';
    }
    if (status === 'running') {
      return 'bg-amber-100 text-amber-800';
    }
    return 'bg-rose-100 text-rose-800';
  };

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-semibold">Workflow Studio</h1>
        <p className="text-sm text-ink/60">Design confidence with branch visibility, live traces, and execution telemetry.</p>
      </header>

      <section className="rounded-2xl border border-ink/10 bg-white p-4 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-medium text-ink/70">Smart Lead Orchestration Map</h2>
          <div className="flex items-center gap-2 text-xs text-ink/60">
            <Route className="h-4 w-4 text-accent" />
            Branching by qualification tier
          </div>
        </div>

        <div className="workflow-map">
          <div className="flow-node flow-node-main">Start</div>
          <div className="flow-arrow">-&gt;</div>
          <div className="flow-node flow-node-main">Sales Qualifier</div>
          <div className="flow-arrow">-&gt;</div>
          <div className="flow-node flow-node-main">Decision</div>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <article className="flow-branch flow-hot">
            <h3 className="text-xs font-semibold tracking-wide">HOT PATH</h3>
            <p className="mt-1 text-xs text-ink/70">Salesforce sync, meeting scheduling, and team notification.</p>
          </article>
          <article className="flow-branch flow-warm">
            <h3 className="text-xs font-semibold tracking-wide">WARM PATH</h3>
            <p className="mt-1 text-xs text-ink/70">Salesforce lead creation and nurture sequence kickoff.</p>
          </article>
          <article className="flow-branch flow-cold">
            <h3 className="text-xs font-semibold tracking-wide">COLD PATH</h3>
            <p className="mt-1 text-xs text-ink/70">Newsletter onboarding and lower-touch follow-up.</p>
          </article>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <article className="rounded-2xl border border-ink/10 bg-white p-4">
          <p className="text-xs uppercase tracking-wide text-ink/50">Total Workflow Runs</p>
          <p className="mt-2 text-3xl font-semibold text-ink">{totalRuns}</p>
        </article>
        <article className="rounded-2xl border border-ink/10 bg-white p-4">
          <p className="text-xs uppercase tracking-wide text-ink/50">Path Success Rate</p>
          <p className="mt-2 text-3xl font-semibold text-moss">{successRate}%</p>
        </article>
        <article className="rounded-2xl border border-ink/10 bg-white p-4">
          <p className="text-xs uppercase tracking-wide text-ink/50">Live Stream</p>
          <p className="mt-2 text-sm text-ink/70">{executionId ? `Tracking ${executionId.slice(0, 8)}...` : 'Idle'}</p>
        </article>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <form onSubmit={onExecute} className="rounded-2xl border border-ink/10 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-medium text-ink/70">Execute Smart Lead Workflow</h3>
            <div className="flex gap-2">
              <button type="button" onClick={() => setSamplePayload('hot')} className="rounded-full bg-rose-100 px-3 py-1 text-xs font-medium text-rose-700">HOT</button>
              <button type="button" onClick={() => setSamplePayload('warm')} className="rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-700">WARM</button>
              <button type="button" onClick={() => setSamplePayload('cold')} className="rounded-full bg-sky-100 px-3 py-1 text-xs font-medium text-sky-700">COLD</button>
            </div>
          </div>
          <textarea
            value={payloadText}
            onChange={(event) => setPayloadText(event.target.value)}
            className="h-52 w-full rounded-xl border border-ink/20 bg-shell/70 p-3 font-mono text-xs"
          />
          {payloadError ? (
            <p className="mt-3 flex items-center gap-2 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700">
              <CircleAlert className="h-4 w-4" />
              {payloadError}
            </p>
          ) : null}
          <button
            className="mt-3 inline-flex items-center gap-2 rounded-lg bg-ink px-4 py-2 text-sm text-white disabled:cursor-not-allowed disabled:opacity-60"
            type="submit"
            disabled={isExecuting}
          >
            {isExecuting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
            {isExecuting ? 'Running...' : 'Run Workflow'}
          </button>
        </form>

        <div className="rounded-2xl border border-ink/10 bg-white p-4 shadow-sm">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-sm font-medium text-ink/70">Real-Time Execution Updates</h3>
            <span className="inline-flex items-center gap-1 rounded-full bg-ink/5 px-2 py-1 text-xs text-ink/60">
              <RadioTower className="h-3.5 w-3.5" />
              SSE
            </span>
          </div>
          <p className="mb-2 text-xs text-ink/60">Execution ID: {executionId || 'none'}</p>
          <div className="h-60 overflow-auto rounded-xl border border-ink/10 bg-shell/80 p-2 text-xs">
            {streamEvents.map((line, index) => (
              <pre key={index} className="mb-2 whitespace-pre-wrap break-all">{line}</pre>
            ))}
            {streamEvents.length === 0 ? <p className="text-ink/50">Run a workflow to watch event updates.</p> : null}
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-ink/10 bg-white p-4 shadow-sm">
        <h3 className="mb-2 text-sm font-medium text-ink/70">Workflow Path Metrics</h3>
        <div className="overflow-auto rounded-xl border border-ink/10">
          <table className="min-w-full text-sm bg-white">
            <thead>
              <tr className="border-b border-ink/10 text-left text-ink/60">
                <th className="px-3 py-2">Path</th>
                <th className="px-3 py-2">Runs</th>
                <th className="px-3 py-2">Success</th>
                <th className="px-3 py-2">Share</th>
              </tr>
            </thead>
            <tbody>
              {pathRows.map((row) => {
                const share = totalRuns === 0 ? 0 : Math.round((row.runs / totalRuns) * 100);

                return (
                <tr key={row.path} className="border-b border-ink/5">
                  <td className="px-3 py-2">{row.path}</td>
                  <td className="px-3 py-2">{row.runs}</td>
                  <td className="px-3 py-2">{row.success}</td>
                  <td className="px-3 py-2">
                    <div className="w-32 rounded-full bg-ink/10">
                      <div className="h-2 rounded-full bg-moss" style={{ width: `${share}%` }} />
                    </div>
                    <span className="ml-2 text-xs text-ink/60">{share}%</span>
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-2xl border border-ink/10 bg-white p-4 shadow-sm">
        <h3 className="mb-2 text-sm font-medium text-ink/70">Execution History</h3>
        <div className="overflow-auto rounded-xl border border-ink/10">
          <table className="min-w-full text-sm bg-white">
            <thead>
              <tr className="border-b border-ink/10 text-left text-ink/60">
                <th className="px-3 py-2">Execution ID</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Path</th>
                <th className="px-3 py-2">Started</th>
              </tr>
            </thead>
            <tbody>
              {executions.map((execution: { executionId: string; status: string; path: string[]; startedAt: string }) => (
                <tr key={execution.executionId} className="border-b border-ink/5">
                  <td className="px-3 py-2 font-mono text-xs">{execution.executionId}</td>
                  <td className="px-3 py-2 capitalize">
                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium ${getStatusClasses(execution.status)}`}>
                      {execution.status === 'completed' ? <CheckCircle2 className="h-3.5 w-3.5" /> : null}
                      {execution.status === 'failed' ? <CircleAlert className="h-3.5 w-3.5" /> : null}
                      {execution.status === 'running' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                      {execution.status}
                    </span>
                  </td>
                  <td className="px-3 py-2">{execution.path.join(' -> ') || 'n/a'}</td>
                  <td className="px-3 py-2">{new Date(execution.startedAt).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};
