import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Cell,
} from 'recharts';
import { fetchDashboard } from '../lib/api';
import { StatCard } from '../components/StatCard';
import { SystemStatus } from '../components/SystemStatus';

export const DashboardHomePage = () => {
  const { data } = useQuery({
    queryKey: ['dashboard'],
    queryFn: fetchDashboard,
    refetchInterval: 5000,
  });

  const dashboard = data?.data;
  const recentMetrics = dashboard?.recentMetrics || [];

  const trendData = useMemo(
    () =>
      recentMetrics
        .slice()
        .reverse()
        .map((item: { timestamp: string; durationMs: number; tokensUsed: number }) => ({
          time: new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          latency: item.durationMs,
          tokens: item.tokensUsed,
        })),
    [recentMetrics]
  );

  const agentDistribution = useMemo(() => {
    const source = dashboard?.byAgent || {};
    return Object.keys(source).map((key) => ({
      name: key,
      value: source[key].totalExecutions,
    }));
  }, [dashboard]);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold">AgentFlow Dashboard</h1>
          <p className="mt-1 text-sm text-ink/60">System telemetry, performance, and execution insights.</p>
        </div>
        <SystemStatus />
      </header>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Executions (24h)" value={String(dashboard?.overall?.totalExecutions || 0)} trend="+12%" />
        <StatCard title="Success Rate" value={`${(dashboard?.overall?.successRate || 0).toFixed(1)}%`} trend="+0.5%" />
        <StatCard title="Avg Latency" value={`${dashboard?.overall?.avgDurationMs || 0}ms`} trend="-0.3s" />
        <StatCard title="Cost Today" value={`$${(((dashboard?.overall?.avgTokensUsed || 0) * (dashboard?.overall?.totalExecutions || 0) * 0.003) / 1000).toFixed(2)}`} trend="+$3.20" />
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <article className="rounded-2xl border border-ink/10 bg-white p-4">
          <h2 className="mb-3 text-sm font-medium text-ink/70">Execution Trend</h2>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendData}>
                <XAxis dataKey="time" />
                <YAxis />
                <Tooltip />
                <Line type="monotone" dataKey="latency" stroke="#1f6f50" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </article>

        <article className="rounded-2xl border border-ink/10 bg-white p-4">
          <h2 className="mb-3 text-sm font-medium text-ink/70">Agent Distribution</h2>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={agentDistribution} dataKey="value" nameKey="name" outerRadius={100}>
                  {agentDistribution.map((_entry, index) => (
                    <Cell
                      key={`slice-${index}`}
                      fill={['#1f6f50', '#d97706', '#0d1b2a', '#86efac'][index % 4]}
                    />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </article>
      </section>

      <section className="rounded-2xl border border-ink/10 bg-white p-4">
        <h2 className="mb-3 text-sm font-medium text-ink/70">Recent Activity</h2>
        <div className="overflow-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-ink/10 text-left text-ink/60">
                <th className="py-2">Agent</th>
                <th className="py-2">Duration</th>
                <th className="py-2">Tokens</th>
                <th className="py-2">Success</th>
                <th className="py-2">Timestamp</th>
              </tr>
            </thead>
            <tbody>
              {recentMetrics.map((row: { id: string; agentName: string; durationMs: number; tokensUsed: number; success: boolean; timestamp: string }) => (
                <tr key={row.id} className="border-b border-ink/5">
                  <td className="py-2">{row.agentName}</td>
                  <td className="py-2">{row.durationMs}ms</td>
                  <td className="py-2">{row.tokensUsed}</td>
                  <td className="py-2">{row.success ? 'yes' : 'no'}</td>
                  <td className="py-2">{new Date(row.timestamp).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};
