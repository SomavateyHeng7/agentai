#!/usr/bin/env node

/*
  Seeds demo metrics and workflow executions by invoking local APIs.
  Run with backend server started on localhost:3000.
*/

const axios = require('axios');

const api = axios.create({ baseURL: 'http://localhost:3000', timeout: 10000 });

const salesLead = {
  email: 'demo@acme.com',
  company: 'Acme Demo',
  message: 'We need enterprise automation and have budget approved this quarter.',
  source: 'website',
};

const supportTicket = {
  id: 'TICKET-DEMO-100',
  subject: 'Login issue in production',
  message: 'Users are reporting login errors after deployment.',
  customerEmail: 'ops@acme.com',
};

const contentRequest = {
  type: 'blog',
  topic: 'AI workflow orchestration',
  targetAudience: 'Engineering managers',
  tone: 'professional',
  keywords: ['ai', 'workflow', 'automation'],
};

async function seed() {
  await api.post('/api/agents/sales/qualify', salesLead).catch(() => {});
  await api.post('/api/agents/support/triage', supportTicket).catch(() => {});
  await api.post('/api/agents/content/generate', contentRequest).catch(() => {});
  await api.post('/api/workflows/execute', salesLead).catch(() => {});
  await api
    .post('/api/ab-tests', {
      agentType: 'sales-qualify',
      variantA: 'v1',
      variantB: 'v2',
      samples: [salesLead],
      runsPerSample: 1,
    })
    .catch(() => {});

  // eslint-disable-next-line no-console
  console.log('Demo seed completed.');
}

seed().catch((error) => {
  // eslint-disable-next-line no-console
  console.error(error.message || String(error));
  process.exit(1);
});
