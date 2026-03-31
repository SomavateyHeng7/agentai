import { describe, expect, it } from '@jest/globals';
import { SupportTicketSchema, SupportTriageResultSchema } from '../src/types';
import { supportTriagePrompt } from '../src/prompts';

describe('support triage contracts', () => {
  it('validates a well-formed ticket payload', () => {
    const ticket = {
      id: 'TICKET-1001',
      subject: 'Cannot log in after update',
      message: 'Our admin users cannot access the dashboard since the latest deployment.',
      customerEmail: 'ops@acme.com',
    };

    const parsed = SupportTicketSchema.safeParse(ticket);
    expect(parsed.success).toBe(true);
  });

  it('rejects a ticket missing required fields', () => {
    const parsed = SupportTicketSchema.safeParse({ subject: 'No id or message' });
    expect(parsed.success).toBe(false);
  });

  it('builds prompt pack with required JSON instructions', () => {
    const prompt = supportTriagePrompt({
      id: 'TICKET-2000',
      subject: 'Billing charge incorrect',
      message: 'I was charged twice for my subscription this month.',
      customerEmail: 'user@example.com',
    });

    expect(prompt.system).toContain('You MUST respond with valid JSON only');
    expect(prompt.user).toContain('Please triage this support ticket');
  });

  it('validates a well-formed triage result', () => {
    const result = {
      priority: 'HIGH',
      team: 'BILLING',
      summary: 'Customer was double-charged. Needs refund investigation.',
      autoResponse: 'Thank you for reaching out. Our billing team will review this shortly.',
      shouldAutoRespond: false,
      estimatedResolutionTime: '2 hours',
      tags: ['billing', 'duplicate-charge'],
    };

    const parsed = SupportTriageResultSchema.safeParse(result);
    expect(parsed.success).toBe(true);
  });

  it('rejects an invalid priority value', () => {
    const result = {
      priority: 'URGENT',
      team: 'ENGINEERING',
      summary: 'System is down.',
      autoResponse: 'We are looking into this.',
      shouldAutoRespond: false,
    };

    const parsed = SupportTriageResultSchema.safeParse(result);
    expect(parsed.success).toBe(false);
  });

  it('accepts optional zendesk payload in triage result', () => {
    const result = {
      priority: 'CRITICAL',
      team: 'ENGINEERING',
      summary: 'Production API is returning 500s.',
      autoResponse: 'Our engineering team has been alerted and is investigating.',
      shouldAutoRespond: false,
      zendeskData: {
        ticketId: '123456',
        status: 'open',
        assigneeGroup: 'Engineering Support',
      },
    };

    const parsed = SupportTriageResultSchema.safeParse(result);
    expect(parsed.success).toBe(true);
  });
});
