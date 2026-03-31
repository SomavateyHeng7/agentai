import { describe, expect, it } from '@jest/globals';
import { SalesLeadSchema, SalesQualificationResultSchema } from '../src/types';
import { salesQualificationPrompt } from '../src/prompts';

describe('sales qualification contracts', () => {
  it('validates a well-formed lead payload', () => {
    const lead = {
      email: 'cto@example.com',
      company: 'Acme Corp',
      message: 'We need enterprise automation and have budget approved for this quarter.',
      source: 'website',
    };

    const parsed = SalesLeadSchema.safeParse(lead);
    expect(parsed.success).toBe(true);
  });

  it('builds prompt pack with required JSON instructions', () => {
    const prompt = salesQualificationPrompt({
      email: 'buyer@example.com',
      company: 'Example Co',
      message: 'Need pricing and onboarding details for our team.',
      source: 'referral',
    });

    expect(prompt.system).toContain('You MUST respond with valid JSON only');
    expect(prompt.user).toContain('Please qualify this incoming sales lead');
  });

  it('rejects out-of-range score in model output', () => {
    const invalidOutput = {
      score: 120,
      tier: 'HOT',
      reasoning: 'Too high score for validation test',
      nextAction: 'Schedule call',
    };

    const parsed = SalesQualificationResultSchema.safeParse(invalidOutput);
    expect(parsed.success).toBe(false);
  });

  it('accepts optional meeting payload in model output contract', () => {
    const outputWithMeeting = {
      score: 88,
      tier: 'HOT',
      reasoning: 'Strong intent and budget signals.',
      nextAction: 'Schedule discovery call',
      meetingData: {
        meetingId: 'mtg_1234',
        status: 'scheduled',
        scheduledAt: new Date().toISOString(),
        meetingUrl: 'https://mock-meetings.example.com/meeting/mtg_1234',
      },
    };

    const parsed = SalesQualificationResultSchema.safeParse(outputWithMeeting);
    expect(parsed.success).toBe(true);
  });
});
