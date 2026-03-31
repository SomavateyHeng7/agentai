import { z } from 'zod';
import { salesforceAdapter } from '../../integrations/salesforce';
import { SalesLeadSchema, SalesQualificationResultSchema } from '../../types';
import { ToolDefinition } from '../framework';
import { logBusinessAction } from '../observability';

const createSalesforceLeadInputSchema = z.object({
  traceId: z.string().min(1),
  lead: SalesLeadSchema,
  qualification: SalesQualificationResultSchema,
});

type CreateSalesforceLeadInput = z.infer<typeof createSalesforceLeadInputSchema>;

export interface CreateSalesforceLeadOutput {
  leadId: string;
  opportunityId?: string;
  status: string;
}

export const createSalesforceLeadTool: ToolDefinition<
  CreateSalesforceLeadInput,
  CreateSalesforceLeadOutput
> = {
  name: 'createSalesforceLead',
  description: 'Creates a Salesforce lead and optional opportunity for qualified sales leads.',
  inputSchema: createSalesforceLeadInputSchema,
  execute: async (input, context) => {
    logBusinessAction('entry', {
      traceId: context.traceId,
      action: 'tool.createSalesforceLead',
      metadata: { company: input.lead.company, tier: input.qualification.tier },
    });

    try {
      const result = await salesforceAdapter.createLead(input.lead, input.qualification);

      logBusinessAction('exit', {
        traceId: context.traceId,
        action: 'tool.createSalesforceLead',
        metadata: { leadId: result.leadId, opportunityId: result.opportunityId || null },
      });

      return {
        leadId: result.leadId,
        opportunityId: result.opportunityId,
        status: result.status,
      };
    } catch (error) {
      logBusinessAction('error', {
        traceId: context.traceId,
        action: 'tool.createSalesforceLead',
        metadata: { error: String(error) },
      });
      throw error;
    }
  },
};
