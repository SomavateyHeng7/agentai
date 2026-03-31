import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  getWorkflowExecution,
  getWorkflowExecutions,
  getWorkflowPathMetrics,
  startSmartLeadWorkflow,
} from '../src/workflows/orchestrator';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method === 'POST') {
      const execution = await startSmartLeadWorkflow(req.body);
      res.status(202).json({ success: true, data: execution });
      return;
    }

    if (req.method === 'GET') {
      const mode = String(req.query.mode || 'list');
      if (mode === 'metrics') {
        res.json({ success: true, data: getWorkflowPathMetrics() });
        return;
      }

      if (mode === 'execution' && req.query.executionId) {
        const execution = getWorkflowExecution(String(req.query.executionId));
        if (!execution) {
          res.status(404).json({ success: false, error: 'Workflow execution not found.' });
          return;
        }

        res.json({ success: true, data: execution });
        return;
      }

      res.json({ success: true, data: getWorkflowExecutions() });
      return;
    }

    res.status(405).json({ success: false, error: 'Method not allowed.' });
  } catch (error) {
    res.status(400).json({ success: false, error: error instanceof Error ? error.message : String(error) });
  }
}
