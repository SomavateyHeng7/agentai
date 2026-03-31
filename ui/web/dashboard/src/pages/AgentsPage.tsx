import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { fetchDashboard } from '../lib/api';

export const AgentsPage = () => {
  const [query, setQuery] = useState('');
  const { data } = useQuery({
    queryKey: ['agents-dashboard'],
    queryFn: fetchDashboard,
    refetchInterval: 5000,
  });

  const byAgent = data?.data?.byAgent || {};

  const agents = useMemo(() =>
    Object.keys(byAgent).map((name) => {
      const stats = byAgent[name];
      const status = stats.successRate > 95 ? 'active' : stats.successRate > 80 ? 'paused' : 'error';
      return {
        id: name,
        name,
        successRate: stats.successRate,
        avgLatencyMs: stats.avgDurationMs,
        executions: stats.totalExecutions,
        status,
      };
    }).filter((item) => item.name.toLowerCase().includes(query.toLowerCase())),
  [byAgent, query]);

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Agents</h1>
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search agents"
          className="rounded-xl border border-ink/20 bg-white px-3 py-2 text-sm"
        />
      </header>

      <div className="overflow-auto rounded-2xl border border-ink/10 bg-white p-4">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-ink/10 text-left text-ink/60">
              <th className="py-2">Agent</th>
              <th className="py-2">Status</th>
              <th className="py-2">Success Rate</th>
              <th className="py-2">Avg Latency</th>
              <th className="py-2">Executions</th>
              <th className="py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {agents.map((agent) => (
              <tr key={agent.id} className="border-b border-ink/5">
                <td className="py-2 font-medium">{agent.name}</td>
                <td className="py-2 capitalize">{agent.status}</td>
                <td className="py-2">{agent.successRate.toFixed(1)}%</td>
                <td className="py-2">{agent.avgLatencyMs}ms</td>
                <td className="py-2">{agent.executions}</td>
                <td className="py-2">
                  <Link className="rounded-md bg-ink px-3 py-1 text-xs text-white" to={`/agents/${agent.id}`}>
                    Open
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
