import { FormEvent, useMemo, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { agentFlowAPI } from '../api/client';

const AGENTS = [
  'sales-qualify',
  'sales-orchestrate',
  'support-triage',
  'content-generate',
] as const;

const defaultPayloads: Record<(typeof AGENTS)[number], string> = {
  'sales-qualify': JSON.stringify(
    {
      email: 'cto@example.com',
      company: 'Acme Corp',
      message: 'Need enterprise automation and budget approved.',
      source: 'website',
    },
    null,
    2
  ),
  'sales-orchestrate': JSON.stringify(
    {
      email: 'vp.sales@example.com',
      company: 'Growth Labs',
      message: 'We need a demo this week and have active budget.',
      source: 'referral',
    },
    null,
    2
  ),
  'support-triage': JSON.stringify(
    {
      id: 'TICKET-1123',
      subject: 'Unable to login',
      message: 'Our team cannot login after latest release.',
      customerEmail: 'ops@example.com',
    },
    null,
    2
  ),
  'content-generate': JSON.stringify(
    {
      type: 'blog',
      topic: 'AI sales automation',
      targetAudience: 'B2B sales leaders',
      tone: 'professional',
      keywords: ['ai', 'sales automation'],
    },
    null,
    2
  ),
};

export const PlaygroundPage = () => {
  const [agent, setAgent] = useState<(typeof AGENTS)[number]>('sales-qualify');
  const [mode, setMode] = useState<'form' | 'json'>('json');
  const [jsonInput, setJsonInput] = useState(defaultPayloads['sales-qualify']);
  const [savedCases, setSavedCases] = useState<Array<{ id: string; agent: string; payload: string }>>([]);

  const executeMutation = useMutation({
    mutationFn: (payload: unknown) => agentFlowAPI.executeAgent(agent, payload),
  });

  const parsedMetrics = useMemo(() => {
    const result = executeMutation.data as
      | { meta?: { durationMs?: number; tokensUsed?: number }; success?: boolean }
      | undefined;

    const durationMs = result?.meta?.durationMs || 0;
    const tokens = result?.meta?.tokensUsed || 0;
    const cost = ((tokens * 0.003) / 1000).toFixed(4);

    return { durationMs, tokens, cost, success: result?.success };
  }, [executeMutation.data]);

  const onExecute = (event: FormEvent) => {
    event.preventDefault();
    const payload = JSON.parse(jsonInput);
    executeMutation.mutate(payload);
  };

  const onSave = () => {
    const item = {
      id: `${Date.now()}`,
      agent,
      payload: jsonInput,
    };

    const next = [item, ...savedCases].slice(0, 20);
    setSavedCases(next);
    localStorage.setItem('agentflow-playground-cases', JSON.stringify(next));
  };

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-semibold">Playground</h1>
        <p className="text-sm text-ink/60">Interactive testing for each agent with JSON output and metrics.</p>
      </header>

      <form className="space-y-4 rounded-2xl border border-ink/10 bg-white p-4" onSubmit={onExecute}>
        <div className="grid gap-3 md:grid-cols-3">
          <label className="text-sm">
            Agent
            <select
              className="mt-1 w-full rounded-lg border border-ink/20 px-3 py-2"
              value={agent}
              onChange={(event) => {
                const value = event.target.value as (typeof AGENTS)[number];
                setAgent(value);
                setJsonInput(defaultPayloads[value]);
              }}
            >
              {AGENTS.map((agentOption) => (
                <option key={agentOption} value={agentOption}>
                  {agentOption}
                </option>
              ))}
            </select>
          </label>

          <label className="text-sm md:col-span-2">
            Input Mode
            <div className="mt-1 inline-flex rounded-lg border border-ink/20 bg-shell p-1">
              <button
                type="button"
                className={`rounded-md px-3 py-1 text-xs ${mode === 'form' ? 'bg-ink text-white' : ''}`}
                onClick={() => setMode('form')}
              >
                Form
              </button>
              <button
                type="button"
                className={`rounded-md px-3 py-1 text-xs ${mode === 'json' ? 'bg-ink text-white' : ''}`}
                onClick={() => setMode('json')}
              >
                JSON
              </button>
            </div>
          </label>
        </div>

        <textarea
          className="h-56 w-full rounded-xl border border-ink/20 p-3 font-mono text-xs"
          value={jsonInput}
          onChange={(event) => setJsonInput(event.target.value)}
          aria-label="Agent input JSON"
        />

        <div className="flex flex-wrap gap-2">
          <button className="rounded-lg bg-ink px-4 py-2 text-sm text-white" type="submit">
            {executeMutation.isPending ? 'Executing...' : 'Execute Agent'}
          </button>
          <button className="rounded-lg border border-ink/20 px-4 py-2 text-sm" type="button" onClick={onSave}>
            Save Test Case
          </button>
        </div>
      </form>

      <section className="rounded-2xl border border-ink/10 bg-white p-4">
        <h2 className="mb-3 text-sm font-medium text-ink/70">Results</h2>
        <div className="mb-3 flex flex-wrap gap-2 text-xs">
          <span className="rounded-full bg-shell px-3 py-1">{parsedMetrics.durationMs}ms</span>
          <span className="rounded-full bg-shell px-3 py-1">{parsedMetrics.tokens} tokens</span>
          <span className="rounded-full bg-shell px-3 py-1">${parsedMetrics.cost}</span>
          <span className="rounded-full bg-shell px-3 py-1">{parsedMetrics.success ? 'success' : 'pending/error'}</span>
        </div>

        <pre className="max-h-96 overflow-auto rounded-xl border border-ink/10 bg-shell p-3 text-xs">
          {JSON.stringify(executeMutation.data || {}, null, 2)}
        </pre>
      </section>

      <section className="rounded-2xl border border-ink/10 bg-white p-4">
        <h2 className="mb-3 text-sm font-medium text-ink/70">Saved Test Cases</h2>
        <div className="space-y-2 text-xs">
          {savedCases.map((item) => (
            <button
              key={item.id}
              className="block w-full rounded-lg border border-ink/10 bg-shell px-3 py-2 text-left"
              onClick={() => {
                setAgent(item.agent as (typeof AGENTS)[number]);
                setJsonInput(item.payload);
              }}
            >
              {item.agent} - {item.id}
            </button>
          ))}
        </div>
      </section>
    </div>
  );
};
