import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { agentFlowAPI } from '../api/client';
import { DataTable } from '../components/DataTable';

interface AlertRule {
  id: string;
  name: string;
  enabled: boolean;
  threshold: number;
  metric: 'errorRate' | 'latencyMs';
}

export const MonitoringPage = () => {
  const queryClient = useQueryClient();
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [liveFeed, setLiveFeed] = useState<string[]>([]);

  const resourcesQuery = useQuery({
    queryKey: ['monitoring-resources'],
    queryFn: () => agentFlowAPI.getMonitoringResources(),
    refetchInterval: autoRefresh ? 5000 : false,
  });

  const alertsQuery = useQuery({
    queryKey: ['monitoring-alerts'],
    queryFn: () => agentFlowAPI.getAlertRules(),
    refetchInterval: autoRefresh ? 10000 : false,
  });

  const updateAlertMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: { enabled?: boolean; threshold?: number } }) =>
      agentFlowAPI.updateAlertRule(id, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['monitoring-alerts'] }),
  });

  useEffect(() => {
    const socket = new WebSocket('ws://localhost:3000/ws/metrics');

    socket.onmessage = (event) => {
      setLiveFeed((prev) => [event.data, ...prev].slice(0, 50));
    };

    socket.onerror = () => {
      setLiveFeed((prev) => ['WebSocket disconnected. Retrying on refresh.', ...prev].slice(0, 50));
    };

    return () => {
      socket.close();
    };
  }, []);

  const resources = (resourcesQuery.data as { data?: { memory?: { rss: number; heapUsed: number }; cpuLoad?: number[]; uptime?: number; recentErrors?: Array<{ id: string; agentName: string; error: string; timestamp: string }> } } | undefined)?.data;
  const alerts = ((alertsQuery.data as { data?: AlertRule[] } | undefined)?.data || []) as AlertRule[];

  const alertRows = useMemo(
    () =>
      alerts.map((rule) => [
        rule.name,
        rule.metric,
        String(rule.threshold),
        rule.enabled ? 'enabled' : 'disabled',
        <button
          key={rule.id}
          className="rounded border border-ink/20 px-2 py-1 text-xs"
          onClick={() =>
            updateAlertMutation.mutate({
              id: rule.id,
              payload: { enabled: !rule.enabled },
            })
          }
        >
          Toggle
        </button>,
      ]),
    [alerts, updateAlertMutation]
  );

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Monitoring</h1>
          <p className="text-sm text-ink/60">Live stream, resource usage, errors, and alert rules.</p>
        </div>
        <label className="inline-flex items-center gap-2 text-sm">
          <input type="checkbox" checked={autoRefresh} onChange={(e) => setAutoRefresh(e.target.checked)} />
          Auto-refresh
        </label>
      </header>

      <section className="grid gap-3 md:grid-cols-3">
        <article className="rounded-xl border border-ink/10 bg-white p-3 text-sm">
          RSS: {Math.round((resources?.memory?.rss || 0) / (1024 * 1024))} MB
        </article>
        <article className="rounded-xl border border-ink/10 bg-white p-3 text-sm">
          Heap Used: {Math.round((resources?.memory?.heapUsed || 0) / (1024 * 1024))} MB
        </article>
        <article className="rounded-xl border border-ink/10 bg-white p-3 text-sm">
          Uptime: {Math.round(resources?.uptime || 0)}s
        </article>
      </section>

      <section className="rounded-2xl border border-ink/10 bg-white p-4">
        <h2 className="mb-2 text-sm font-medium text-ink/70">Real-time Execution Stream (WebSocket)</h2>
        <div className="h-48 overflow-auto rounded-xl border border-ink/10 bg-shell p-2 text-xs">
          {liveFeed.map((item, index) => (
            <pre key={index} className="mb-2 whitespace-pre-wrap break-all">{item}</pre>
          ))}
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <article className="rounded-2xl border border-ink/10 bg-white p-4">
          <h2 className="mb-2 text-sm font-medium text-ink/70">Error Logs</h2>
          <div className="overflow-auto">
            <DataTable
              headers={['ID', 'Agent', 'Error', 'Timestamp']}
              rows={
                (resources?.recentErrors || []).map((error) => [
                  <span key={`${error.id}-id`} className="font-mono text-xs">{error.id}</span>,
                  error.agentName,
                  error.error,
                  new Date(error.timestamp).toLocaleString(),
                ])
              }
            />
          </div>
        </article>

        <article className="rounded-2xl border border-ink/10 bg-white p-4">
          <h2 className="mb-2 text-sm font-medium text-ink/70">Alert Rules</h2>
          <DataTable headers={['Name', 'Metric', 'Threshold', 'Status', 'Action']} rows={alertRows} />
        </article>
      </section>
    </div>
  );
};
