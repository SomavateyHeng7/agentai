/**
 * Ground-truth accuracy evaluation suite.
 *
 * These tests use labeled examples with known expected outputs to measure
 * whether the scoring logic (mock or live LLM) produces correct results.
 * Schema conformance is necessary but not sufficient — these tests prove
 * the model is actually making the right decisions.
 */

import { SalesQualificationResultSchema, SupportTriageResultSchema } from '../src/types';

// ─── Sales Qualification Labeled Cases ───────────────────────────────────────

interface SalesEvalCase {
  description: string;
  message: string;
  expected: {
    tier: 'HOT' | 'WARM' | 'COLD' | 'UNQUALIFIED';
    scoreMin: number;
    scoreMax: number;
    confidence?: 'HIGH' | 'MEDIUM' | 'LOW';
  };
}

export const SALES_EVAL_CASES: SalesEvalCase[] = [
  // ── HOT: all 4 BANT signals confirmed ──────────────────────────────────────
  {
    description: 'HOT: short message, all BANT locked',
    message: "budget sorted, need 50 seats by end of month, I'm the one who signs off",
    expected: { tier: 'HOT', scoreMin: 90, scoreMax: 100, confidence: 'HIGH' },
  },
  {
    description: 'HOT: CFO-approved budget, clear need, Q2 deadline',
    message: 'We have budget approved by the CFO. We need this for our team of 30 engineers by end of Q2. I run the engineering org.',
    expected: { tier: 'HOT', scoreMin: 88, scoreMax: 100, confidence: 'HIGH' },
  },
  {
    description: 'HOT: casual but decisive buying signal',
    message: "money's there, need it asap, I'm the boss here, we got 20 people waiting",
    expected: { tier: 'HOT', scoreMin: 85, scoreMax: 100, confidence: 'HIGH' },
  },

  // ── WARM: partial BANT signals ─────────────────────────────────────────────
  {
    description: 'WARM: budget present but authority unclear',
    message: 'We have budget but our CEO needs to approve first. Q2 timeline. Looking for something for our team.',
    expected: { tier: 'WARM', scoreMin: 60, scoreMax: 79, confidence: 'MEDIUM' },
  },
  {
    description: 'WARM: evaluating vendors this quarter, no budget stated',
    message: 'Interested in your product. We are evaluating a few vendors this quarter for our 15-person team.',
    expected: { tier: 'WARM', scoreMin: 60, scoreMax: 79, confidence: 'MEDIUM' },
  },
  {
    description: 'WARM: clear need and timeline, budget vague',
    message: 'We urgently need a solution for automation. Budget discussions are happening internally right now.',
    expected: { tier: 'WARM', scoreMin: 62, scoreMax: 79, confidence: 'MEDIUM' },
  },

  // ── COLD: vague interest, weak signals ────────────────────────────────────
  {
    description: 'COLD: general interest, no timeline or budget',
    message: 'we might be interested sometime this year, not sure on budget yet',
    expected: { tier: 'COLD', scoreMin: 40, scoreMax: 59, confidence: 'LOW' },
  },
  {
    description: 'COLD: researching phase, no commitment',
    message: 'Just doing some research on tools like yours. No specific timeline yet.',
    expected: { tier: 'COLD', scoreMin: 40, scoreMax: 59 },
  },

  // ── UNQUALIFIED: no real intent ────────────────────────────────────────────
  {
    description: 'UNQUALIFIED: explicit no-intent',
    message: 'just browsing, no plans to buy this year',
    expected: { tier: 'UNQUALIFIED', scoreMin: 0, scoreMax: 39, confidence: 'HIGH' },
  },
  {
    description: 'UNQUALIFIED: feature request with no purchase intent',
    message: 'Hi, just wanted to ask if you have an API. Not looking to buy anything.',
    expected: { tier: 'UNQUALIFIED', scoreMin: 0, scoreMax: 39 },
  },

  // ── Negation handling — must NOT score budget/urgency ─────────────────────
  {
    description: 'COLD: negation — "no budget" must not trigger budget signal',
    message: "We don't have budget right now and no urgent timeline. Just exploring options.",
    expected: { tier: 'COLD', scoreMin: 40, scoreMax: 59 },
  },
  {
    description: 'COLD: negation — "no rush" must not trigger urgency signal',
    message: 'We have some budget but there is no rush on our end. Happy to chat eventually.',
    expected: { tier: 'WARM', scoreMin: 60, scoreMax: 79 }, // budget yes, urgency no → WARM
  },
];

// ─── Support Triage Labeled Cases ─────────────────────────────────────────────

interface SupportEvalCase {
  description: string;
  subject: string;
  message: string;
  expected: {
    priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
    team: 'ENGINEERING' | 'BILLING' | 'GENERAL' | 'SALES';
    shouldAutoRespond: boolean;
  };
}

export const SUPPORT_EVAL_CASES: SupportEvalCase[] = [
  // ── CRITICAL ───────────────────────────────────────────────────────────────
  {
    description: 'CRITICAL: production outage',
    subject: 'Site is down',
    message: 'Our entire platform is down, affecting all customers. Production outage.',
    expected: { priority: 'CRITICAL', team: 'ENGINEERING', shouldAutoRespond: false },
  },
  {
    description: 'CRITICAL: payment failure at scale',
    subject: 'Payment failures',
    message: 'All of our customers are seeing payment failure errors. Revenue is being impacted.',
    expected: { priority: 'CRITICAL', team: 'BILLING', shouldAutoRespond: false },
  },

  // ── HIGH ───────────────────────────────────────────────────────────────────
  {
    description: 'HIGH: login broken after reset — auth bug evidence',
    subject: 'Cannot log in',
    message: "I reset my password but still can't log in. The system keeps saying invalid credentials.",
    expected: { priority: 'HIGH', team: 'ENGINEERING', shouldAutoRespond: false },
  },
  {
    description: 'HIGH: billing dispute',
    subject: 'Double charge',
    message: 'I was charged twice this month. Please investigate and refund the extra charge.',
    expected: { priority: 'HIGH', team: 'BILLING', shouldAutoRespond: false },
  },
  {
    description: 'HIGH: casual locked-out message',
    subject: 'help',
    message: "yo cant log in wtf, tried resetting my password twice it's still broken",
    expected: { priority: 'HIGH', team: 'ENGINEERING', shouldAutoRespond: false },
  },

  // ── MEDIUM ─────────────────────────────────────────────────────────────────
  {
    description: 'MEDIUM: minor UI glitch, first attempt',
    subject: 'Button not working',
    message: 'The export button on the dashboard seems to do nothing. Tried once.',
    expected: { priority: 'MEDIUM', team: 'ENGINEERING', shouldAutoRespond: true },
  },

  // ── LOW ────────────────────────────────────────────────────────────────────
  {
    description: 'LOW: how-to question',
    subject: 'How to export data',
    message: 'How do I export my data to CSV? I cannot find the option.',
    expected: { priority: 'LOW', team: 'GENERAL', shouldAutoRespond: true },
  },
  {
    description: 'LOW: upgrade inquiry — sales signal',
    subject: 'Pricing for more seats',
    message: 'We want to upgrade to enterprise. What is the pricing for 100 seats?',
    expected: { priority: 'LOW', team: 'SALES', shouldAutoRespond: true },
  },
];

// ─── Validators ───────────────────────────────────────────────────────────────

/**
 * Validates a sales qualification result against a labeled ground-truth case.
 * Returns an array of failure messages (empty = pass).
 */
export function validateSalesAccuracy(
  result: unknown,
  expected: SalesEvalCase['expected'],
  description: string
): string[] {
  const failures: string[] = [];

  const parsed = SalesQualificationResultSchema.safeParse(result);
  if (!parsed.success) {
    failures.push(`[${description}] Schema validation failed: ${parsed.error.errors.map((e) => e.message).join(', ')}`);
    return failures;
  }

  const { score, tier, confidence } = parsed.data;

  if (tier !== expected.tier) {
    failures.push(`[${description}] Tier mismatch: expected ${expected.tier}, got ${tier} (score=${score})`);
  }
  if (score < expected.scoreMin || score > expected.scoreMax) {
    failures.push(
      `[${description}] Score out of expected range [${expected.scoreMin}-${expected.scoreMax}]: got ${score}`
    );
  }
  if (expected.confidence && confidence !== expected.confidence) {
    failures.push(`[${description}] Confidence mismatch: expected ${expected.confidence}, got ${confidence}`);
  }

  return failures;
}

/**
 * Validates a support triage result against a labeled ground-truth case.
 * Returns an array of failure messages (empty = pass).
 */
export function validateSupportAccuracy(
  result: unknown,
  expected: SupportEvalCase['expected'],
  description: string
): string[] {
  const failures: string[] = [];

  const parsed = SupportTriageResultSchema.safeParse(result);
  if (!parsed.success) {
    failures.push(`[${description}] Schema validation failed: ${parsed.error.errors.map((e) => e.message).join(', ')}`);
    return failures;
  }

  const { priority, team, shouldAutoRespond } = parsed.data;

  if (priority !== expected.priority) {
    failures.push(`[${description}] Priority mismatch: expected ${expected.priority}, got ${priority}`);
  }
  if (team !== expected.team) {
    failures.push(`[${description}] Team mismatch: expected ${expected.team}, got ${team}`);
  }
  if (shouldAutoRespond !== expected.shouldAutoRespond) {
    failures.push(
      `[${description}] shouldAutoRespond mismatch: expected ${expected.shouldAutoRespond}, got ${shouldAutoRespond}`
    );
  }

  return failures;
}
