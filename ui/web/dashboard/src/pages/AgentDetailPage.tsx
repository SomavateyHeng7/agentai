import { Tab, TabGroup, TabList, TabPanel, TabPanels } from '@headlessui/react';
import { useQuery } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import { fetchAgentMetrics } from '../lib/api';

export const AgentDetailPage = () => {
  const { agentId = '' } = useParams();
  const { data } = useQuery({
    queryKey: ['agent-detail', agentId],
    queryFn: () => fetchAgentMetrics(agentId),
    refetchInterval: 5000,
  });

  const records = data?.data?.records || [];
  const stats = data?.data?.stats;

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-semibold">{agentId}</h1>
        <p className="text-sm text-ink/60">Detailed telemetry, executions, and prompt controls.</p>
      </header>

      <div className="grid gap-3 md:grid-cols-3">
        <div className="rounded-xl border border-ink/10 bg-white p-4">Success: {stats?.successRate?.toFixed(1) || 0}%</div>
        <div className="rounded-xl border border-ink/10 bg-white p-4">Avg latency: {stats?.avgDurationMs || 0}ms</div>
        <div className="rounded-xl border border-ink/10 bg-white p-4">Executions: {stats?.totalExecutions || 0}</div>
      </div>

      <TabGroup>
        <TabList className="flex gap-2">
          {['Overview', 'Executions', 'Metrics', 'Prompts', 'Settings'].map((tab) => (
            <Tab key={tab} className="rounded-lg border border-ink/20 bg-white px-3 py-1 text-sm data-[selected]:bg-ink data-[selected]:text-white">
              {tab}
            </Tab>
          ))}
        </TabList>

        <TabPanels className="mt-4">
          <TabPanel className="rounded-xl border border-ink/10 bg-white p-4 text-sm">Agent configuration overview.</TabPanel>
          <TabPanel className="rounded-xl border border-ink/10 bg-white p-4">
            <div className="overflow-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-ink/10 text-left text-ink/60">
                    <th className="py-2">Timestamp</th>
                    <th className="py-2">Duration</th>
                    <th className="py-2">Tokens</th>
                    <th className="py-2">Success</th>
                  </tr>
                </thead>
                <tbody>
                  {records.map((record: { id: string; timestamp: string; durationMs: number; tokensUsed: number; success: boolean }) => (
                    <tr key={record.id} className="border-b border-ink/5">
                      <td className="py-2">{new Date(record.timestamp).toLocaleString()}</td>
                      <td className="py-2">{record.durationMs}ms</td>
                      <td className="py-2">{record.tokensUsed}</td>
                      <td className="py-2">{record.success ? 'yes' : 'no'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </TabPanel>
          <TabPanel className="rounded-xl border border-ink/10 bg-white p-4 text-sm">Latency and success visualizations.</TabPanel>
          <TabPanel className="rounded-xl border border-ink/10 bg-white p-4 text-sm">
            <p className="mb-3 font-medium text-ink">Prompt Pack</p>
            <p className="mb-2 text-ink/70">Version: <span className="font-mono">v1</span></p>
            <p className="mb-3 text-ink/70">Status: active</p>
            <div className="rounded-lg border border-ink/10 bg-sand p-3">
              <p className="font-mono text-xs text-ink/80">System instruction preview</p>
              <p className="mt-2 text-ink/70">
                Structured output mode enabled. This panel is wired for prompt version visibility and can be extended
                with an editor + save action when you add prompt management APIs.
              </p>
            </div>
          </TabPanel>
          <TabPanel className="rounded-xl border border-ink/10 bg-white p-4 text-sm">
            <p className="mb-3 font-medium text-ink">Runtime Settings</p>
            <div className="grid gap-2 md:grid-cols-2">
              <div className="rounded-lg border border-ink/10 bg-sand p-3">
                <p className="text-xs uppercase tracking-wide text-ink/60">Polling interval</p>
                <p className="mt-1 font-medium">5s</p>
              </div>
              <div className="rounded-lg border border-ink/10 bg-sand p-3">
                <p className="text-xs uppercase tracking-wide text-ink/60">Alert threshold</p>
                <p className="mt-1 font-medium">95th percentile &gt; 4s</p>
              </div>
              <div className="rounded-lg border border-ink/10 bg-sand p-3">
                <p className="text-xs uppercase tracking-wide text-ink/60">Retries</p>
                <p className="mt-1 font-medium">Exponential backoff</p>
              </div>
              <div className="rounded-lg border border-ink/10 bg-sand p-3">
                <p className="text-xs uppercase tracking-wide text-ink/60">Mode</p>
                <p className="mt-1 font-medium">Observation only</p>
              </div>
            </div>
          </TabPanel>
        </TabPanels>
      </TabGroup>
    </div>
  );
};
