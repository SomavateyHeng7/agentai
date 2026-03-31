import { Router } from 'express';
import os from 'os';
import { getMetrics } from '../integrations/database';

interface AlertRule {
  id: string;
  name: string;
  enabled: boolean;
  threshold: number;
  metric: 'errorRate' | 'latencyMs';
}

const alertRules: AlertRule[] = [
  { id: 'latency-spike', name: 'Latency Spike', enabled: true, threshold: 2500, metric: 'latencyMs' },
  { id: 'error-rate', name: 'Error Rate', enabled: true, threshold: 5, metric: 'errorRate' },
];

const webhookIntegrations = [
  { id: 'slack-default', target: 'slack', enabled: false, url: '' },
];

export const monitoringRouter = Router();

monitoringRouter.get('/resources', async (_req, res) => {
  const memory = process.memoryUsage();
  const cpuLoad = os.loadavg();
  const metrics = await getMetrics();
  const recentErrors = metrics.filter((item) => !item.success).slice(-20).map((item) => ({
    id: item.id,
    agentName: item.agentName,
    error: item.error || 'Unknown error',
    timestamp: item.timestamp,
  }));

  res.json({
    success: true,
    data: {
      memory,
      cpuLoad,
      uptime: process.uptime(),
      recentErrors,
    },
  });
});

monitoringRouter.get('/alerts', (_req, res) => {
  res.json({ success: true, data: alertRules });
});

monitoringRouter.put('/alerts/:id', (req, res) => {
  const alert = alertRules.find((item) => item.id === req.params.id);
  if (!alert) {
    res.status(404).json({ success: false, error: 'Alert rule not found.' });
    return;
  }

  alert.enabled = typeof req.body?.enabled === 'boolean' ? req.body.enabled : alert.enabled;
  alert.threshold = typeof req.body?.threshold === 'number' ? req.body.threshold : alert.threshold;

  res.json({ success: true, data: alert });
});

monitoringRouter.get('/webhooks', (_req, res) => {
  res.json({ success: true, data: webhookIntegrations });
});
