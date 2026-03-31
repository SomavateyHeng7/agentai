import { SupportTicket, SupportTriageResult } from '../types';
import { createLogger, format, transports } from 'winston';

const logger = createLogger({
  level: 'info',
  format: format.combine(format.timestamp(), format.json()),
  transports: [new transports.Console()],
});

// ─── Zendesk Types ────────────────────────────────────────────────────────────

export interface ZendeskTicket {
  id: string;
  subject: string;
  status: 'new' | 'open' | 'pending' | 'hold' | 'solved' | 'closed';
  priority: 'urgent' | 'high' | 'normal' | 'low';
  type: 'problem' | 'incident' | 'question' | 'task';
  assigneeId?: string;
  groupId?: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  url: string;
}

export interface ZendeskComment {
  id: string;
  ticketId: string;
  body: string;
  public: boolean;
  authorId: string;
  createdAt: string;
}

export interface ZendeskResponse {
  ticketId: string;
  status: string;
  assigneeGroup: string;
  url: string;
}

// ─── Mock Data Generators ─────────────────────────────────────────────────────

function generateMockTicketId(): string {
  return Math.floor(Math.random() * 900000 + 100000).toString();
}

const priorityMap: Record<string, ZendeskTicket['priority']> = {
  CRITICAL: 'urgent',
  HIGH: 'high',
  MEDIUM: 'normal',
  LOW: 'low',
};

const groupMap: Record<string, string> = {
  ENGINEERING: 'Engineering Support',
  BILLING: 'Billing & Accounts',
  SALES: 'Sales Team',
  GENERAL: 'General Support',
};

function mockZendeskTicket(
  ticket: SupportTicket,
  triage: SupportTriageResult
): ZendeskTicket {
  return {
    id: generateMockTicketId(),
    subject: ticket.subject,
    status: triage.priority === 'CRITICAL' ? 'open' : 'new',
    priority: priorityMap[triage.priority] || 'normal',
    type: triage.team === 'ENGINEERING' ? 'problem' : 'question',
    groupId: `group_${triage.team.toLowerCase()}`,
    tags: triage.tags || [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    url: `https://mock.zendesk.com/tickets/${generateMockTicketId()}`,
  };
}

// ─── Zendesk Adapter ──────────────────────────────────────────────────────────

export class ZendeskAdapter {
  private isMockMode: boolean;
  private subdomain: string;
  private baseUrl: string;

  constructor() {
    this.isMockMode = process.env.USE_MOCK_INTEGRATIONS === 'true';
    this.subdomain = process.env.ZENDESK_SUBDOMAIN || 'mock-company';
    this.baseUrl = `https://${this.subdomain}.zendesk.com`;

    if (this.isMockMode) {
      logger.info('[Zendesk] Running in MOCK mode');
    } else {
      logger.info('[Zendesk] Running in LIVE mode', { subdomain: this.subdomain });
    }
  }

  async createTicket(
    ticket: SupportTicket,
    triage: SupportTriageResult
  ): Promise<ZendeskResponse> {
    if (this.isMockMode) {
      const mockTicket = mockZendeskTicket(ticket, triage);
      const assigneeGroup = groupMap[triage.team] || 'General Support';

      logger.info('[Zendesk MOCK] Creating ticket', {
        ticketId: mockTicket.id,
        subject: ticket.subject,
        priority: mockTicket.priority,
        group: assigneeGroup,
      });

      return {
        ticketId: mockTicket.id,
        status: mockTicket.status,
        assigneeGroup,
        url: `${this.baseUrl}/agent/tickets/${mockTicket.id}`,
      };
    }

    // Real Zendesk API implementation would go here
    throw new Error(
      'Live Zendesk integration not implemented. Set USE_MOCK_INTEGRATIONS=true'
    );
  }

  async updateTicket(
    id: string,
    data: Partial<ZendeskTicket>
  ): Promise<{ success: boolean; id: string }> {
    if (this.isMockMode) {
      logger.info('[Zendesk MOCK] Updating ticket', { id, fields: Object.keys(data) });
      return { success: true, id };
    }

    throw new Error(
      'Live Zendesk integration not implemented. Set USE_MOCK_INTEGRATIONS=true'
    );
  }

  async sendAutoResponse(ticketId: string, responseText: string): Promise<ZendeskComment> {
    if (this.isMockMode) {
      const comment: ZendeskComment = {
        id: `comment_${Math.random().toString(36).substring(2, 10)}`,
        ticketId,
        body: responseText,
        public: true,
        authorId: 'agent_ai_assistant',
        createdAt: new Date().toISOString(),
      };

      logger.info('[Zendesk MOCK] Auto-response sent', {
        ticketId,
        commentId: comment.id,
        responseLength: responseText.length,
      });

      return comment;
    }

    throw new Error(
      'Live Zendesk integration not implemented. Set USE_MOCK_INTEGRATIONS=true'
    );
  }

  async getTicket(id: string): Promise<ZendeskTicket | null> {
    if (this.isMockMode) {
      logger.info('[Zendesk MOCK] Getting ticket', { id });
      return {
        id,
        subject: 'Mock Support Ticket',
        status: 'open',
        priority: 'normal',
        type: 'question',
        tags: ['mock', 'retrieved'],
        createdAt: new Date(Date.now() - 3600000).toISOString(),
        updatedAt: new Date().toISOString(),
        url: `${this.baseUrl}/agent/tickets/${id}`,
      };
    }

    throw new Error(
      'Live Zendesk integration not implemented. Set USE_MOCK_INTEGRATIONS=true'
    );
  }

  async escalateTicket(id: string, reason: string): Promise<{ success: boolean }> {
    if (this.isMockMode) {
      logger.warn('[Zendesk MOCK] Ticket escalated', { id, reason });
      return { success: true };
    }

    throw new Error(
      'Live Zendesk integration not implemented. Set USE_MOCK_INTEGRATIONS=true'
    );
  }
}

// ─── Singleton Export ─────────────────────────────────────────────────────────

export const zendeskAdapter = new ZendeskAdapter();

export const createTicket = (ticket: SupportTicket, triage: SupportTriageResult) =>
  zendeskAdapter.createTicket(ticket, triage);

export const updateTicket = (id: string, data: Partial<ZendeskTicket>) =>
  zendeskAdapter.updateTicket(id, data);

export const sendAutoResponse = (ticketId: string, response: string) =>
  zendeskAdapter.sendAutoResponse(ticketId, response);
