/* eslint-disable no-console */
const baseUrl = process.env.AGENTFLOW_BASE_URL || 'http://localhost:3000';

async function post(path, body) {
  const res = await fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return res.json();
}

async function run() {
  console.log('Running AgentFlow demo against:', baseUrl);

  const sales = await post('/api/agents/sales/qualify', {
    email: 'founder@fastgrow.ai',
    company: 'FastGrow AI',
    message: 'We need enterprise support automation for 300 agents and have budget this quarter.',
    source: 'referral',
  });
  console.log('\n[Sales Qualification]\n', JSON.stringify(sales, null, 2));

  const support = await post('/api/agents/support/triage', {
    id: 'TICKET-2001',
    subject: 'Billing discrepancy on annual invoice',
    message: 'We were charged twice this month and need a correction today.',
    customerEmail: 'finance@acme.com',
  });
  console.log('\n[Support Triage]\n', JSON.stringify(support, null, 2));

  const content = await post('/api/agents/content/generate', {
    type: 'blog',
    topic: 'AI workflow automation for support operations',
    targetAudience: 'SaaS support leaders',
    tone: 'professional',
    keywords: ['AI automation', 'support operations', 'customer experience'],
    includeCallToAction: true,
  });
  console.log('\n[Content Generation]\n', JSON.stringify(content, null, 2));

  const healthRes = await fetch(`${baseUrl}/health`);
  const health = await healthRes.json();
  console.log('\n[Health]\n', JSON.stringify(health, null, 2));
}

run().catch((err) => {
  console.error('Demo failed:', err);
  process.exit(1);
});
