'use client';

import { FormEvent, useEffect, useState } from 'react';

interface MeetingData {
  meetingId?: string;
  status?: string;
  scheduledAt?: string;
  meetingUrl?: string;
}

interface SalesforceData {
  leadId?: string;
  opportunityId?: string;
  status?: string;
}

interface QualificationResult {
  score: number;
  tier: 'HOT' | 'WARM' | 'COLD' | 'UNQUALIFIED';
  reasoning: string;
  nextAction: string;
  keyInsights?: string[];
  estimatedDealSize?: string;
  salesforceData?: SalesforceData;
  meetingData?: MeetingData;
}

interface ApiResponse {
  success: boolean;
  data?: QualificationResult;
  error?: string;
  meta?: {
    durationMs: number;
    tokensUsed: number;
    retryCount: number;
  };
}

const TIER_CONFIG = {
  HOT: { label: 'HOT', cls: 'tier-hot' },
  WARM: { label: 'WARM', cls: 'tier-warm' },
  COLD: { label: 'COLD', cls: 'tier-cold' },
  UNQUALIFIED: { label: 'UNQUALIFIED', cls: 'tier-unqualified' },
} as const;

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function HomePage() {
  const [health, setHealth] = useState<'ok' | 'degraded' | 'offline' | 'loading'>('loading');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ApiResponse | null>(null);

  useEffect(() => {
    fetch('/health')
      .then((r) => r.json())
      .then((j) => setHealth(j?.status ?? 'offline'))
      .catch(() => setHealth('offline'));
  }, []);

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setResult(null);

    const fd = new FormData(e.currentTarget);

    try {
      const res = await fetch('/api/agents/sales/qualify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: String(fd.get('email') ?? ''),
          company: String(fd.get('company') ?? ''),
          source: String(fd.get('source') ?? 'website'),
          message: String(fd.get('message') ?? ''),
          name: String(fd.get('name') ?? '') || undefined,
          budget: String(fd.get('budget') ?? '') || undefined,
        }),
      });
      const json: ApiResponse = await res.json();
      setResult(json);
    } catch (err) {
      setResult({ success: false, error: String(err) });
    } finally {
      setLoading(false);
    }
  };

  const data = result?.success ? result.data : undefined;
  const meta = result?.meta;
  const tierCfg = data ? TIER_CONFIG[data.tier] : undefined;

  return (
    <main className="page">
      <header className="page-header">
        <div>
          <p className="kicker">AgentFlow</p>
          <h1>Schedule a Meeting</h1>
          <p className="subtitle">Qualify a sales lead — HOT leads auto-schedule a discovery call.</p>
        </div>
        <span className={`health-badge health-${health}`}>{health}</span>
      </header>

      <div className="layout">
        {/* ── Form ── */}
        <section className="card">
          <h2 className="card-title">Lead Details</h2>
          <form className="form" onSubmit={onSubmit}>
            <label className="field-label">
              Name
              <input className="field" name="name" placeholder="Alex Johnson" />
            </label>
            <label className="field-label">
              Work Email <span className="required">*</span>
              <input className="field" name="email" type="email" placeholder="cto@company.com" required />
            </label>
            <label className="field-label">
              Company <span className="required">*</span>
              <input className="field" name="company" placeholder="Acme Corp" required />
            </label>
            <div className="row-2">
              <label className="field-label">
                Lead Source
                <select className="field" name="source" defaultValue="website">
                  <option value="website">Website</option>
                  <option value="referral">Referral</option>
                  <option value="linkedin">LinkedIn</option>
                  <option value="event">Event</option>
                  <option value="cold-outreach">Cold Outreach</option>
                  <option value="other">Other</option>
                </select>
              </label>
              <label className="field-label">
                Budget (optional)
                <input className="field" name="budget" placeholder="e.g. $50k/yr" />
              </label>
            </div>
            <label className="field-label">
              Message <span className="required">*</span>
              <textarea
                className="field"
                name="message"
                rows={4}
                placeholder="Tell us about your use case, team size, and timeline…"
                required
              />
            </label>
            <button className="submit-btn" type="submit" disabled={loading}>
              {loading ? 'Qualifying…' : 'Qualify & Schedule'}
            </button>
          </form>
        </section>

        {/* ── Result ── */}
        <section className="card result-card">
          <h2 className="card-title">Result</h2>

          {!result && !loading && (
            <p className="empty-state">Submit the form to see qualification results and meeting details.</p>
          )}

          {loading && <div className="skeleton-stack"><div className="skeleton" /><div className="skeleton" /><div className="skeleton short" /></div>}

          {result && !result.success && (
            <div className="error-box">{result.error ?? 'Unknown error'}</div>
          )}

          {data && tierCfg && (
            <div className="result-body">
              {/* Score + Tier */}
              <div className="score-row">
                <div className="score-circle">
                  <span className="score-value">{data.score}</span>
                  <span className="score-label">/ 100</span>
                </div>
                <div>
                  <span className={`tier-chip ${tierCfg.cls}`}>{tierCfg.label}</span>
                  {data.estimatedDealSize && (
                    <p className="deal-size">Est. deal: {data.estimatedDealSize}</p>
                  )}
                </div>
              </div>

              {/* Meeting card — primary focus */}
              {data.meetingData?.meetingId ? (
                <div className="meeting-card">
                  <div className="meeting-header">
                    <span className="meeting-icon">&#x1F4C5;</span>
                    <div>
                      <p className="meeting-title">Discovery Call Scheduled</p>
                      <p className="meeting-status">{data.meetingData.status}</p>
                    </div>
                  </div>
                  {data.meetingData.scheduledAt && (
                    <p className="meeting-time">{formatDate(data.meetingData.scheduledAt)}</p>
                  )}
                  {data.meetingData.meetingUrl && (
                    <a className="meeting-link" href={data.meetingData.meetingUrl} target="_blank" rel="noreferrer">
                      Join Meeting &rarr;
                    </a>
                  )}
                  <p className="meeting-id">ID: {data.meetingData.meetingId}</p>
                </div>
              ) : (
                <div className="no-meeting-note">
                  No meeting scheduled — lead did not reach HOT threshold or action did not require a call.
                </div>
              )}

              {/* Next action */}
              <div className="info-block">
                <p className="info-label">Next Action</p>
                <p className="info-value">{data.nextAction}</p>
              </div>

              {/* Reasoning */}
              <div className="info-block">
                <p className="info-label">Reasoning</p>
                <p className="info-value reasoning">{data.reasoning}</p>
              </div>

              {/* Key insights */}
              {data.keyInsights && data.keyInsights.length > 0 && (
                <div className="info-block">
                  <p className="info-label">Key Insights</p>
                  <ul className="insights-list">
                    {data.keyInsights.map((insight, i) => (
                      <li key={i}>{insight}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Salesforce */}
              {data.salesforceData?.leadId && (
                <div className="sf-row">
                  <span className="sf-badge">Salesforce</span>
                  <span className="sf-id">Lead {data.salesforceData.leadId}</span>
                  {data.salesforceData.opportunityId && (
                    <span className="sf-id opp">Opp {data.salesforceData.opportunityId}</span>
                  )}
                </div>
              )}

              {/* Meta */}
              {meta && (
                <p className="meta-row">
                  {meta.durationMs}ms &middot; {meta.tokensUsed} tokens
                  {meta.retryCount > 0 ? ` · ${meta.retryCount} retries` : ''}
                </p>
              )}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
