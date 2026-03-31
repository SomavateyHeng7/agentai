import { z } from 'zod';

// ─── Sales Lead ───────────────────────────────────────────────────────────────

export const SalesLeadSchema = z.object({
  email: z.string().email('Invalid email address'),
  company: z.string().min(1, 'Company name is required'),
  message: z.string().min(10, 'Message must be at least 10 characters'),
  source: z.enum(['website', 'referral', 'linkedin', 'event', 'cold-outreach', 'other']),
  name: z.string().optional(),
  phone: z.string().optional(),
  budget: z.string().optional(),
  teamSize: z.number().int().positive().optional(),
});

export type SalesLead = z.infer<typeof SalesLeadSchema>;

export const SalesQualificationResultSchema = z.object({
  score: z.number().int().min(0).max(100),
  tier: z.enum(['HOT', 'WARM', 'COLD', 'UNQUALIFIED']),
  reasoning: z.string().min(1),
  nextAction: z.string().min(1),
  keyInsights: z.array(z.string()).optional(),
  estimatedDealSize: z.string().optional(),
  salesforceData: z
    .object({
      leadId: z.string().optional(),
      opportunityId: z.string().optional(),
      status: z.string().optional(),
    })
    .optional(),
  meetingData: z
    .object({
      meetingId: z.string().optional(),
      status: z.enum(['scheduled', 'pending']).optional(),
      scheduledAt: z.string().optional(),
      meetingUrl: z.string().optional(),
    })
    .optional(),
});

export type SalesQualificationResult = z.infer<typeof SalesQualificationResultSchema>;

// ─── Support Ticket ───────────────────────────────────────────────────────────

export const SupportTicketSchema = z.object({
  id: z.string().min(1, 'Ticket ID is required'),
  subject: z.string().min(1, 'Subject is required'),
  message: z.string().min(10, 'Message must be at least 10 characters'),
  customerEmail: z.string().email('Invalid customer email'),
  priority: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  category: z
    .enum(['technical', 'billing', 'account', 'feature-request', 'general'])
    .optional(),
  attachments: z.array(z.string()).optional(),
  previousTickets: z.number().int().nonnegative().optional(),
});

export type SupportTicket = z.infer<typeof SupportTicketSchema>;

export const SupportTriageResultSchema = z.object({
  priority: z.enum(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']),
  team: z.enum(['ENGINEERING', 'BILLING', 'GENERAL', 'SALES']),
  summary: z.string().min(1),
  autoResponse: z.string().min(1),
  shouldAutoRespond: z.boolean(),
  estimatedResolutionTime: z.string().optional(),
  tags: z.array(z.string()).optional(),
  zendeskData: z
    .object({
      ticketId: z.string().optional(),
      status: z.string().optional(),
      assigneeGroup: z.string().optional(),
    })
    .optional(),
});

export type SupportTriageResult = z.infer<typeof SupportTriageResultSchema>;

// ─── Content Request ──────────────────────────────────────────────────────────

export const ContentRequestSchema = z.object({
  type: z.enum(['blog', 'email', 'social']),
  topic: z.string().min(3, 'Topic must be at least 3 characters'),
  targetAudience: z.string().min(3, 'Target audience description required'),
  tone: z.enum(['professional', 'casual', 'technical', 'inspirational', 'humorous']),
  keywords: z.array(z.string()).min(1, 'At least one keyword required').max(10),
  wordCount: z.number().int().positive().optional(),
  includeCallToAction: z.boolean().optional(),
  brandVoice: z.string().optional(),
});

export type ContentRequest = z.infer<typeof ContentRequestSchema>;

export const ContentResultSchema = z.object({
  title: z.string().min(1),
  content: z.string().min(1),
  excerpt: z.string().min(1),
  seoKeywords: z.array(z.string()),
  estimatedReadTime: z.string(),
  wordCount: z.number().int().positive(),
  metaDescription: z.string().optional(),
  hashtags: z.array(z.string()).optional(),
  callToAction: z.string().optional(),
});

export type ContentResult = z.infer<typeof ContentResultSchema>;

// ─── Agent Metrics ────────────────────────────────────────────────────────────

export const AgentMetricsSchema = z.object({
  agentName: z.enum([
    'sales-qualifier',
    'sales-orchestrator',
    'support-triage',
    'content-generator',
  ]),
  durationMs: z.number().nonnegative(),
  tokensUsed: z.number().int().nonnegative(),
  success: z.boolean(),
  validationPassed: z.boolean(),
  retryCount: z.number().int().nonnegative(),
  error: z.string().optional(),
  tier: z.string().optional(),
  priority: z.string().optional(),
  timestamp: z.date().optional(),
});

export type AgentMetrics = z.infer<typeof AgentMetricsSchema>;

export interface AggregatedStats {
  totalExecutions: number;
  successRate: number;
  avgDurationMs: number;
  avgTokensUsed: number;
  avgRetryCount: number;
  validationPassRate: number;
}

// ─── API Response ─────────────────────────────────────────────────────────────

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  meta?: {
    durationMs: number;
    tokensUsed: number;
    retryCount: number;
    agentVersion: string;
  };
}

// ─── Health Check ─────────────────────────────────────────────────────────────

export interface HealthStatus {
  status: 'ok' | 'degraded' | 'down';
  timestamp: string;
  uptime: number;
  version: string;
  services: {
    database: 'ok' | 'error';
    salesforce: 'ok' | 'mock' | 'error';
    zendesk: 'ok' | 'mock' | 'error';
    anthropic: 'ok' | 'error';
  };
}
