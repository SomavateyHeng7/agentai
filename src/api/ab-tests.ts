import { Router } from 'express';
import {
  getABExecutionsByTestId,
  getABTestById,
  listABTests,
  promoteABTestWinner,
  startABTest,
} from '../testing/ab-test';

export const abTestsRouter = Router();

abTestsRouter.post('/', async (req, res) => {
  try {
    const result = await startABTest(req.body);
    res.status(202).json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

abTestsRouter.get('/', (_req, res) => {
  res.json({ success: true, data: listABTests() });
});

abTestsRouter.get('/:testId', (req, res) => {
  const test = getABTestById(req.params.testId);
  if (!test) {
    res.status(404).json({ success: false, error: 'A/B test not found.' });
    return;
  }

  res.json({
    success: true,
    data: {
      test,
      executions: getABExecutionsByTestId(req.params.testId),
    },
  });
});

abTestsRouter.post('/:testId/promote', (req, res) => {
  const winner = req.body?.winner as 'A' | 'B' | undefined;
  if (winner !== 'A' && winner !== 'B') {
    res.status(400).json({ success: false, error: "winner must be 'A' or 'B'." });
    return;
  }

  const promoted = promoteABTestWinner(req.params.testId, winner);
  if (!promoted) {
    res.status(404).json({ success: false, error: 'A/B test not found.' });
    return;
  }

  res.json({ success: true, data: promoted });
});
