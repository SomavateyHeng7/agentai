import { SalesLead, SalesQualificationResult } from '../types';
import { createLogger, format, transports } from 'winston';

const logger = createLogger({
  level: 'info',
  format: format.combine(format.timestamp(), format.json()),
  transports: [new transports.Console()],
});

// ─── Salesforce Types ─────────────────────────────────────────────────────────

export interface SalesforceLead {
  Id: string;
  Email: string;
  Company: string;
  Status: string;
  LeadSource: string;
  Rating: string;
  Description: string;
  CreatedDate: string;
  LastModifiedDate: string;
}

export interface SalesforceOpportunity {
  Id: string;
  Name: string;
  StageName: string;
  Amount: number;
  CloseDate: string;
}

export interface SalesforceResponse {
  leadId: string;
  opportunityId?: string;
  status: string;
  url: string;
}

// ─── Mock Data Generators ─────────────────────────────────────────────────────

function generateMockId(prefix: string): string {
  return `${prefix}${Math.random().toString(36).substring(2, 18).toUpperCase()}`;
}

function mockLeadResponse(lead: SalesLead, qualification: SalesQualificationResult): SalesforceLead {
  const tierToRating: Record<string, string> = {
    HOT: 'Hot',
    WARM: 'Warm',
    COLD: 'Cold',
    UNQUALIFIED: 'Cold',
  };

  return {
    Id: generateMockId('00Q'),
    Email: lead.email,
    Company: lead.company,
    Status: qualification.tier === 'UNQUALIFIED' ? 'Unqualified' : 'Open - Not Contacted',
    LeadSource: lead.source === 'website' ? 'Web' : lead.source,
    Rating: tierToRating[qualification.tier] || 'Cold',
    Description: qualification.reasoning.substring(0, 250),
    CreatedDate: new Date().toISOString(),
    LastModifiedDate: new Date().toISOString(),
  };
}

// ─── Salesforce Adapter ───────────────────────────────────────────────────────

export class SalesforceAdapter {
  private isMockMode: boolean;
  private instanceUrl: string;

  constructor() {
    this.isMockMode = process.env.USE_MOCK_INTEGRATIONS === 'true';
    this.instanceUrl =
      process.env.SALESFORCE_INSTANCE_URL || 'https://mock.salesforce.com';

    if (this.isMockMode) {
      logger.info('[Salesforce] Running in MOCK mode');
    } else {
      logger.info('[Salesforce] Running in LIVE mode', { instanceUrl: this.instanceUrl });
    }
  }

  async createLead(
    lead: SalesLead,
    qualification: SalesQualificationResult
  ): Promise<SalesforceResponse> {
    if (this.isMockMode) {
      const mockLead = mockLeadResponse(lead, qualification);
      logger.info('[Salesforce MOCK] Creating lead', {
        leadId: mockLead.Id,
        company: lead.company,
        email: lead.email,
        rating: mockLead.Rating,
      });

      const response: SalesforceResponse = {
        leadId: mockLead.Id,
        status: mockLead.Status,
        url: `${this.instanceUrl}/leads/${mockLead.Id}`,
      };

      if (qualification.tier === 'HOT') {
        const oppId = generateMockId('006');
        response.opportunityId = oppId;
        logger.info('[Salesforce MOCK] Auto-created opportunity for HOT lead', {
          opportunityId: oppId,
        });
      }

      return response;
    }

    // Real Salesforce API implementation would go here
    // Using jsforce or direct REST API calls
    throw new Error(
      'Live Salesforce integration not implemented. Set USE_MOCK_INTEGRATIONS=true'
    );
  }

  async updateLead(
    id: string,
    data: Partial<SalesforceLead>
  ): Promise<{ success: boolean; id: string }> {
    if (this.isMockMode) {
      logger.info('[Salesforce MOCK] Updating lead', { id, fields: Object.keys(data) });
      return { success: true, id };
    }

    throw new Error(
      'Live Salesforce integration not implemented. Set USE_MOCK_INTEGRATIONS=true'
    );
  }

  async getLead(id: string): Promise<SalesforceLead | null> {
    if (this.isMockMode) {
      logger.info('[Salesforce MOCK] Getting lead', { id });
      return {
        Id: id,
        Email: 'mock@example.com',
        Company: 'Mock Company Inc.',
        Status: 'Working - Contacted',
        LeadSource: 'Web',
        Rating: 'Hot',
        Description: 'Mock lead retrieved from Salesforce',
        CreatedDate: new Date(Date.now() - 86400000).toISOString(),
        LastModifiedDate: new Date().toISOString(),
      };
    }

    throw new Error(
      'Live Salesforce integration not implemented. Set USE_MOCK_INTEGRATIONS=true'
    );
  }

  async convertLeadToOpportunity(
    leadId: string,
    dealName: string
  ): Promise<SalesforceOpportunity | null> {
    if (this.isMockMode) {
      const opp: SalesforceOpportunity = {
        Id: generateMockId('006'),
        Name: dealName,
        StageName: 'Prospecting',
        Amount: Math.floor(Math.random() * 90000) + 10000,
        CloseDate: new Date(Date.now() + 90 * 86400000).toISOString().split('T')[0],
      };
      logger.info('[Salesforce MOCK] Lead converted to opportunity', {
        leadId,
        opportunityId: opp.Id,
      });
      return opp;
    }

    throw new Error(
      'Live Salesforce integration not implemented. Set USE_MOCK_INTEGRATIONS=true'
    );
  }
}

// ─── Singleton Export ─────────────────────────────────────────────────────────

export const salesforceAdapter = new SalesforceAdapter();

export const createLead = (lead: SalesLead, qualification: SalesQualificationResult) =>
  salesforceAdapter.createLead(lead, qualification);

export const updateLead = (id: string, data: Partial<SalesforceLead>) =>
  salesforceAdapter.updateLead(id, data);

export const getLead = (id: string) => salesforceAdapter.getLead(id);
