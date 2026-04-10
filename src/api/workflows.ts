import { Router } from 'express';
import {
  getWorkflowExecution,
  getWorkflowExecutions,
  getWorkflowPathMetrics,
  startSmartLeadWorkflow,
  subscribeWorkflowExecution,
} from '../mastra/workflows/smart-lead-runtime';

export const workflowsRouter = Router();

workflowsRouter.post('/execute', async (req, res) => {
  try {
    const execution = await startSmartLeadWorkflow(req.body);
    res.status(202).json({
      success: true,
      data: execution,
      streamUrl: `/api/workflows/stream/${execution.executionId}`,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

workflowsRouter.get('/executions', (_req, res) => {
  res.json({ success: true, data: getWorkflowExecutions() });
});

workflowsRouter.get('/executions/:executionId', (req, res) => {
  const execution = getWorkflowExecution(req.params.executionId);
  if (!execution) {
    res.status(404).json({ success: false, error: 'Workflow execution not found.' });
    return;
  }

  res.json({ success: true, data: execution });
});

workflowsRouter.get('/metrics/paths', (_req, res) => {
  res.json({ success: true, data: getWorkflowPathMetrics() });
});

workflowsRouter.get('/stream/:executionId', (req, res) => {
  const { executionId } = req.params;
  const execution = getWorkflowExecution(executionId);

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const send = (payload: unknown): void => {
    res.write(`data: ${JSON.stringify(payload)}\n\n`);
  };

  if (!execution) {
    send({ success: false, error: 'Workflow execution not found.' });
    res.end();
    return;
  }

  send({ success: true, data: execution });

  const unsubscribe = subscribeWorkflowExecution(executionId, (updated) => {
    send({ success: true, data: updated });
    if (updated.status !== 'running') {
      unsubscribe();
      res.end();
    }
  });

  req.on('close', () => {
    unsubscribe();
  });
});
