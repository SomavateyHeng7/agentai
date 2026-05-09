import { describe, expect, it } from '@jest/globals';
import {
  SalesLeadSchema,
  SalesQualificationResultSchema,
  SupportTicketSchema,
  SupportTriageResultSchema,
  ContentRequestSchema,
  ContentResultSchema,
} from '../src/types';


describe('SalesLeadSchema — edge cases', () => {
  const base = {
    email: 'user@example.com',
    company: 'X',
    message: 'At least ten chars here.',
    source: 'website' as const,
  };

  it('accepts all valid source values', () => {
    const sources = ['website', 'referral', 'linkedin', 'event', 'cold-outreach', 'other'] as const;
    for (const source of sources) {
      expect(SalesLeadSchema.safeParse({ ...base, source }).success).toBe(true);
    }
  });

  it('rejects an unknown source', () => {
    expect(SalesLeadSchema.safeParse({ ...base, source: 'twitter' }).success).toBe(false);
  });

  it('rejects a message shorter than 10 characters', () => {
    expect(SalesLeadSchema.safeParse({ ...base, message: 'short' }).success).toBe(false);
  });

  it('rejects an invalid email format', () => {
    expect(SalesLeadSchema.safeParse({ ...base, email: 'not-an-email' }).success).toBe(false);
  });

  it('accepts optional fields when provided', () => {
    const result = SalesLeadSchema.safeParse({
      ...base,
      name: 'Alice',
      phone: '+1-555-000-1234',
      budget: '$50k',
      teamSize: 25,
    });
    expect(result.success).toBe(true);
  });

  it('rejects negative teamSize', () => {
    expect(SalesLeadSchema.safeParse({ ...base, teamSize: -1 }).success).toBe(false);
  });

  it('rejects zero teamSize', () => {
    expect(SalesLeadSchema.safeParse({ ...base, teamSize: 0 }).success).toBe(false);
  });

  it('rejects a non-integer teamSize', () => {
    expect(SalesLeadSchema.safeParse({ ...base, teamSize: 5.5 }).success).toBe(false);
  });
});

describe('SalesQualificationResultSchema — edge cases', () => {
  const base = {
    score: 75,
    tier: 'WARM' as const,
    confidence: 'MEDIUM' as const,
    reasoning: 'Solid signals.',
    nextAction: 'Follow up by email.',
  };

  it('accepts score at minimum boundary (0)', () => {
    expect(
      SalesQualificationResultSchema.safeParse({ ...base, score: 0, tier: 'UNQUALIFIED', confidence: 'HIGH' }).success
    ).toBe(true);
  });

  it('accepts score at maximum boundary (100)', () => {
    expect(
      SalesQualificationResultSchema.safeParse({ ...base, score: 100, tier: 'HOT', confidence: 'HIGH' }).success
    ).toBe(true);
  });

  it('rejects score above 100', () => {
    expect(SalesQualificationResultSchema.safeParse({ ...base, score: 101 }).success).toBe(false);
  });

  it('rejects score below 0', () => {
    expect(SalesQualificationResultSchema.safeParse({ ...base, score: -1 }).success).toBe(false);
  });

  it('rejects a non-integer score', () => {
    expect(SalesQualificationResultSchema.safeParse({ ...base, score: 75.5 }).success).toBe(false);
  });

  it('accepts all valid tier values with consistent scores', () => {
    const tierCases = [
      { tier: 'HOT' as const, score: 85 },
      { tier: 'WARM' as const, score: 70 },
      { tier: 'COLD' as const, score: 50 },
      { tier: 'UNQUALIFIED' as const, score: 20 },
    ];
    for (const { tier, score } of tierCases) {
      expect(SalesQualificationResultSchema.safeParse({ ...base, tier, score }).success).toBe(true);
    }
  });

  it('rejects tier that contradicts score range', () => {
    // score=45 (COLD range) with tier=WARM should fail the refinement
    expect(SalesQualificationResultSchema.safeParse({ ...base, score: 45, tier: 'WARM' }).success).toBe(false);
  });

  it('rejects an unknown tier', () => {
    expect(SalesQualificationResultSchema.safeParse({ ...base, tier: 'LUKEWARM' }).success).toBe(false);
  });

  it('accepts optional meetingData with partial fields', () => {
    expect(
      SalesQualificationResultSchema.safeParse({
        ...base,
        meetingData: { status: 'scheduled' },
      }).success
    ).toBe(true);
  });

  it('rejects meetingData with invalid status', () => {
    expect(
      SalesQualificationResultSchema.safeParse({
        ...base,
        meetingData: { status: 'cancelled' },
      }).success
    ).toBe(false);
  });
});

// ─── SupportTicketSchema ──────────────────────────────────────────────────────

describe('SupportTicketSchema — edge cases', () => {
  const base = {
    id: 'TICKET-001',
    subject: 'Login issue',
    message: 'Cannot log in after the latest update.',
    customerEmail: 'user@example.com',
  };

  it('accepts all optional priority levels', () => {
    for (const priority of ['low', 'medium', 'high', 'critical'] as const) {
      expect(SupportTicketSchema.safeParse({ ...base, priority }).success).toBe(true);
    }
  });

  it('rejects an unknown priority', () => {
    expect(SupportTicketSchema.safeParse({ ...base, priority: 'urgent' }).success).toBe(false);
  });

  it('accepts all optional category values', () => {
    const categories = ['technical', 'billing', 'account', 'feature-request', 'general'] as const;
    for (const category of categories) {
      expect(SupportTicketSchema.safeParse({ ...base, category }).success).toBe(true);
    }
  });

  it('rejects negative previousTickets count', () => {
    expect(SupportTicketSchema.safeParse({ ...base, previousTickets: -1 }).success).toBe(false);
  });

  it('accepts zero previousTickets', () => {
    expect(SupportTicketSchema.safeParse({ ...base, previousTickets: 0 }).success).toBe(true);
  });

  it('rejects missing required id field', () => {
    const { id: _id, ...withoutId } = base;
    expect(SupportTicketSchema.safeParse(withoutId).success).toBe(false);
  });

  it('rejects message shorter than 10 characters', () => {
    expect(SupportTicketSchema.safeParse({ ...base, message: 'short' }).success).toBe(false);
  });
});

describe('SupportTriageResultSchema — edge cases', () => {
  const base = {
    priority: 'HIGH' as const,
    team: 'ENGINEERING' as const,
    summary: 'User cannot authenticate.',
    autoResponse: 'We are investigating.',
    shouldAutoRespond: false,
  };

  it('accepts all valid priority values', () => {
    for (const priority of ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'] as const) {
      expect(SupportTriageResultSchema.safeParse({ ...base, priority }).success).toBe(true);
    }
  });

  it('rejects URGENT as a priority (not in schema)', () => {
    expect(SupportTriageResultSchema.safeParse({ ...base, priority: 'URGENT' }).success).toBe(false);
  });

  it('accepts all valid team values', () => {
    for (const team of ['ENGINEERING', 'BILLING', 'GENERAL', 'SALES'] as const) {
      expect(SupportTriageResultSchema.safeParse({ ...base, team }).success).toBe(true);
    }
  });

  it('accepts optional tags array', () => {
    expect(
      SupportTriageResultSchema.safeParse({ ...base, tags: ['login', 'auth'] }).success
    ).toBe(true);
  });

  it('accepts shouldAutoRespond as true', () => {
    expect(
      SupportTriageResultSchema.safeParse({ ...base, shouldAutoRespond: true }).success
    ).toBe(true);
  });
});

// ─── ContentRequestSchema ─────────────────────────────────────────────────────

describe('ContentRequestSchema — edge cases', () => {
  const base = {
    type: 'blog' as const,
    topic: 'AI automation',
    targetAudience: 'SaaS leaders',
    tone: 'professional' as const,
    keywords: ['automation'],
  };

  it('accepts all valid content types', () => {
    for (const type of ['blog', 'email', 'social'] as const) {
      expect(ContentRequestSchema.safeParse({ ...base, type }).success).toBe(true);
    }
  });

  it('rejects unknown content type', () => {
    expect(ContentRequestSchema.safeParse({ ...base, type: 'podcast' }).success).toBe(false);
  });

  it('accepts all valid tone values', () => {
    const tones = ['professional', 'casual', 'technical', 'inspirational', 'humorous'] as const;
    for (const tone of tones) {
      expect(ContentRequestSchema.safeParse({ ...base, tone }).success).toBe(true);
    }
  });

  it('rejects empty keywords array', () => {
    expect(ContentRequestSchema.safeParse({ ...base, keywords: [] }).success).toBe(false);
  });

  it('rejects more than 10 keywords', () => {
    const keywords = Array.from({ length: 11 }, (_, i) => `kw${i}`);
    expect(ContentRequestSchema.safeParse({ ...base, keywords }).success).toBe(false);
  });

  it('accepts exactly 10 keywords', () => {
    const keywords = Array.from({ length: 10 }, (_, i) => `kw${i}`);
    expect(ContentRequestSchema.safeParse({ ...base, keywords }).success).toBe(true);
  });

  it('rejects topic shorter than 3 characters', () => {
    expect(ContentRequestSchema.safeParse({ ...base, topic: 'AI' }).success).toBe(false);
  });
});


describe('ContentResultSchema — edge cases', () => {
  const base = {
    title: 'AI for Teams',
    content: 'Some content here.',
    excerpt: 'A short excerpt.',
    seoKeywords: ['ai', 'automation'],
    estimatedReadTime: '3 min read',
    wordCount: 500,
  };

  it('rejects wordCount of zero', () => {
    expect(ContentResultSchema.safeParse({ ...base, wordCount: 0 }).success).toBe(false);
  });

  it('rejects negative wordCount', () => {
    expect(ContentResultSchema.safeParse({ ...base, wordCount: -10 }).success).toBe(false);
  });

  it('accepts optional hashtags', () => {
    expect(
      ContentResultSchema.safeParse({ ...base, hashtags: ['#AI', '#Automation'] }).success
    ).toBe(true);
  });

  it('accepts optional callToAction', () => {
    expect(
      ContentResultSchema.safeParse({ ...base, callToAction: 'Try it free today.' }).success
    ).toBe(true);
  });
});
