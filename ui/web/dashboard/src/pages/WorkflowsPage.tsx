import { FormEvent, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
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

  const pathRows = useMemo(() => Object.entries(pathMetrics), [pathMetrics]);

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
    };
  };

  const onExecute = async (event: FormEvent) => {
    event.preventDefault();
    const payload = JSON.parse(payloadText);
    const response = await executeWorkflow(payload);
    if (response?.data?.executionId) {
      startStream(response.data.executionId);
    }
  };

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-semibold">Workflows</h1>
        <p className="text-sm text-ink/60">Visualize branches, run workflows, and inspect audit paths.</p>
      </header>

      <section className="rounded-2xl border border-ink/10 bg-white p-4">
        <h2 className="mb-3 text-sm font-medium text-ink/70">Workflow Builder (template)</h2>
        <div className="overflow-auto rounded-xl border border-ink/10 bg-shell p-4 text-sm">
          <p>[Start] -&gt; [Sales Qualifier] -&gt; [Decision]</p>
          <p>|-- HOT -&gt; [Salesforce] -&gt; [Schedule Demo] -&gt; [Notify Sales Rep]</p>
          <p>|-- WARM -&gt; [Salesforce] -&gt; [Nurture Sequence]</p>
          <p>|-- COLD -&gt; [Newsletter]</p>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <form onSubmit={onExecute} className="rounded-2xl border border-ink/10 bg-white p-4">
          <h3 className="mb-2 text-sm font-medium text-ink/70">Execute Smart Lead Workflow</h3>
          <textarea
            value={payloadText}
            onChange={(event) => setPayloadText(event.target.value)}
            className="h-48 w-full rounded-xl border border-ink/20 p-3 font-mono text-xs"
          />
          <button className="mt-3 rounded-lg bg-ink px-4 py-2 text-sm text-white" type="submit">
            Run Workflow
          </button>
        </form>

        <div className="rounded-2xl border border-ink/10 bg-white p-4">
          <h3 className="mb-2 text-sm font-medium text-ink/70">Real-Time Execution Updates (SSE)</h3>
          <p className="mb-2 text-xs text-ink/60">Execution ID: {executionId || 'none'}</p>
          <div className="h-56 overflow-auto rounded-xl border border-ink/10 bg-shell p-2 text-xs">
            {streamEvents.map((line, index) => (
              <pre key={index} className="mb-2 whitespace-pre-wrap break-all">{line}</pre>
            ))}
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-ink/10 bg-white p-4">
        <h3 className="mb-2 text-sm font-medium text-ink/70">Workflow Path Metrics</h3>
        <div className="overflow-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-ink/10 text-left text-ink/60">
                <th className="py-2">Path</th>
                <th className="py-2">Runs</th>
                <th className="py-2">Success</th>
              </tr>
            </thead>
            <tbody>
              {pathRows.map(([pathKey, value]) => (
                <tr key={pathKey} className="border-b border-ink/5">
                  <td className="py-2">{pathKey}</td>
                  <td className="py-2">{(value as { runs: number }).runs}</td>
                  <td className="py-2">{(value as { success: number }).success}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-2xl border border-ink/10 bg-white p-4">
        <h3 className="mb-2 text-sm font-medium text-ink/70">Execution History</h3>
        <div className="overflow-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-ink/10 text-left text-ink/60">
                <th className="py-2">Execution ID</th>
                <th className="py-2">Status</th>
                <th className="py-2">Path</th>
                <th className="py-2">Started</th>
              </tr>
            </thead>
            <tbody>
              {executions.map((execution: { executionId: string; status: string; path: string[]; startedAt: string }) => (
                <tr key={execution.executionId} className="border-b border-ink/5">
                  <td className="py-2 font-mono text-xs">{execution.executionId}</td>
                  <td className="py-2 capitalize">{execution.status}</td>
                  <td className="py-2">{execution.path.join(' -> ') || 'n/a'}</td>
                  <td className="py-2">{new Date(execution.startedAt).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};
