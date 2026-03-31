import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getABExecutionsByTestId, getABTestById, listABTests, startABTest } from '../src/testing/ab-test';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method === 'POST') {
      const result = await startABTest(req.body);
      res.status(202).json({ success: true, data: result });
      return;
    }

    if (req.method === 'GET') {
      if (req.query.testId) {
        const testId = String(req.query.testId);
        const test = getABTestById(testId);
        if (!test) {
          res.status(404).json({ success: false, error: 'A/B test not found.' });
          return;
        }

        res.json({ success: true, data: { test, executions: getABExecutionsByTestId(testId) } });
        return;
      }

      res.json({ success: true, data: listABTests() });
      return;
    }

    res.status(405).json({ success: false, error: 'Method not allowed.' });
  } catch (error) {
    res.status(400).json({ success: false, error: error instanceof Error ? error.message : String(error) });
  }
}
