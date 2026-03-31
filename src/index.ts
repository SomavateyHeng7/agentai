import 'dotenv/config';
import express, { NextFunction, Request, Response } from 'express';
import { WebSocketServer } from 'ws';
import { salesQualifier } from './agents/sales-qualifier';
import { salesOrchestrator } from './agents/sales-orchestrator';
import { supportTriage } from './agents/support-triage';
import { contentGenerator } from './agents/content-generator';
import { getAggregatedStats, getDashboardStats, getMetrics, runMigrations } from './integrations/database';
import { metricsHandler, metricsMiddleware } from './observability/metrics';
import { HealthStatus } from './types';
import { workflowsRouter } from './api/workflows';
import { abTestsRouter } from './api/ab-tests';
import { monitoringRouter } from './api/monitoring';
import { settingsRouter } from './api/settings';

const app = express();
const PORT = Number(process.env.PORT || 3000);

app.use(express.json({ limit: '1mb' }));
app.use(metricsMiddleware);
app.use('/api/workflows', workflowsRouter);
app.use('/api/ab-tests', abTestsRouter);
app.use('/api/monitoring', monitoringRouter);
app.use('/api/settings', settingsRouter);

app.get('/health', async (_req: Request, res: Response) => {
  const isMock = process.env.USE_MOCK_INTEGRATIONS !== 'false';
  const anthropicAvailable = Boolean(process.env.ANTHROPIC_API_KEY) || isMock;

  const health: HealthStatus = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: '1.0.0',
    services: {
      database: 'ok',
      salesforce: isMock ? 'mock' : 'ok',
      zendesk: isMock ? 'mock' : 'ok',
      anthropic: anthropicAvailable ? 'ok' : 'error',
    },
  };

  if (health.services.anthropic === 'error') {
    health.status = 'degraded';
  }

  res.status(health.status === 'ok' ? 200 : 503).json(health);
});

app.post('/api/agents/sales/qualify', async (req: Request, res: Response) => {
  const result = await salesQualifier.qualify(req.body);
  res.status(result.success ? 200 : 400).json(result);
});

app.post('/api/agents/sales/orchestrate', async (req: Request, res: Response) => {
  const result = await salesOrchestrator.orchestrate(req.body);
  res.status(result.success ? 200 : 400).json(result);
});

app.post('/api/agents/support/triage', async (req: Request, res: Response) => {
  const result = await supportTriage.triage(req.body);
  res.status(result.success ? 200 : 400).json(result);
});

app.post('/api/agents/content/generate', async (req: Request, res: Response) => {
  const result = await contentGenerator.generate(req.body);
  res.status(result.success ? 200 : 400).json(result);
});

app.get('/api/dashboard', async (_req: Request, res: Response) => {
  const dashboard = await getDashboardStats();
  res.json({ success: true, data: dashboard });
});

app.get('/api/metrics/:agentName', async (req: Request, res: Response) => {
  const { agentName } = req.params;
  const [stats, records] = await Promise.all([
    getAggregatedStats(agentName),
    getMetrics(agentName),
  ]);

  res.json({
    success: true,
    data: {
      agentName,
      stats,
      records,
    },
  });
});

app.get('/metrics', metricsHandler);

app.get('/', (_req: Request, res: Response) => {
  res.json({
    name: 'AgentFlow API',
    version: '1.0.0',
    ui: 'Run Next.js UI on http://localhost:3001',
    endpoints: [
      'GET /health',
      'POST /api/agents/sales/qualify',
      'POST /api/agents/sales/orchestrate',
      'POST /api/agents/support/triage',
      'POST /api/agents/content/generate',
      'POST /api/workflows/execute',
      'GET /api/workflows/executions',
      'GET /api/workflows/executions/:executionId',
      'GET /api/workflows/metrics/paths',
      'GET /api/workflows/stream/:executionId',
      'POST /api/ab-tests',
      'GET /api/ab-tests',
      'GET /api/ab-tests/:testId',
      'POST /api/ab-tests/:testId/promote',
      'GET /api/monitoring/resources',
      'GET /api/monitoring/alerts',
      'PUT /api/monitoring/alerts/:id',
      'GET /api/monitoring/webhooks',
      'GET /api/settings',
      'PUT /api/settings',
      'GET /api/dashboard',
      'GET /api/metrics/:agentName',
      'GET /metrics',
    ],
  });
});

// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  const message = err instanceof Error ? err.message : 'Unknown server error';
  res.status(500).json({ success: false, error: message });
});

runMigrations()
  .then(() => {
    const server = app.listen(PORT, () => {
      // eslint-disable-next-line no-console
      console.log(`AgentFlow API listening on http://localhost:${PORT}`);
    });

    const wss = new WebSocketServer({ server, path: '/ws/metrics' });
    const pushMetrics = async () => {
      const dashboard = await getDashboardStats();
      const payload = JSON.stringify({
        type: 'metrics',
        timestamp: new Date().toISOString(),
        overall: dashboard.overall,
      });

      for (const client of wss.clients) {
        if (client.readyState === 1) {
          client.send(payload);
        }
      }
    };

    const interval = setInterval(() => {
      pushMetrics().catch(() => {
        // Ignore push failures for disconnected clients.
      });
    }, 3000);

    server.on('close', () => {
      clearInterval(interval);
      wss.close();
    });
  })
  .catch((error) => {
    // eslint-disable-next-line no-console
    console.error('Failed to start AgentFlow', error);
    process.exit(1);
  });
