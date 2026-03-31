import { SalesLead, SupportTicket, ContentRequest } from '../types';

// ─── PromptPack Interface ─────────────────────────────────────────────────────

export interface PromptPack {
  system: string;
  user: string;
}

// ─── Sales Qualification Prompt ───────────────────────────────────────────────

export function salesQualificationPrompt(lead: SalesLead): PromptPack {
  const system = `You are an expert B2B sales qualification AI assistant with deep expertise in evaluating leads for enterprise software companies. Your goal is to analyze incoming sales leads and provide structured qualification assessments.

Evaluate leads based on:
1. BANT framework (Budget, Authority, Need, Timeline)
2. Company characteristics (size, industry, growth stage)
3. Message quality and intent signals
4. Lead source quality
5. Engagement signals and urgency indicators

Scoring rubric:
- 80-100: HOT lead — strong buying signals, clear need, likely budget
- 60-79: WARM lead — interested but needs nurturing, some qualification gaps
- 40-59: COLD lead — minimal signals, likely early-stage or poor fit
- 0-39: UNQUALIFIED — poor fit, spam, or no real intent

You MUST respond with valid JSON only. No markdown, no explanation outside the JSON structure.

Required JSON format:
{
  "score": <integer 0-100>,
  "tier": "<HOT|WARM|COLD|UNQUALIFIED>",
  "reasoning": "<detailed explanation of your score and classification>",
  "nextAction": "<specific actionable next step for the sales team>",
  "keyInsights": ["<insight 1>", "<insight 2>", "<insight 3>"],
  "estimatedDealSize": "<small|medium|large|enterprise>"
}`;

  const user = `Please qualify this incoming sales lead:

Email: ${lead.email}
Company: ${lead.company}
Source: ${lead.source}
${lead.name ? `Contact Name: ${lead.name}` : ''}
${lead.phone ? `Phone: ${lead.phone}` : ''}
${lead.budget ? `Budget Mentioned: ${lead.budget}` : ''}
${lead.teamSize ? `Team Size: ${lead.teamSize}` : ''}

Message from lead:
---
${lead.message}
---

Analyze this lead thoroughly and provide your qualification assessment in the required JSON format.`;

  return { system, user };
}

// ─── Support Triage Prompt ────────────────────────────────────────────────────

export function supportTriagePrompt(ticket: SupportTicket): PromptPack {
  const system = `You are an expert customer support triage AI with deep knowledge of SaaS customer success operations. Your role is to analyze incoming support tickets and route them to the appropriate team with the right priority.

Priority classification:
- CRITICAL: System down, data loss, security breach, revenue impact — requires immediate response
- HIGH: Major feature broken, significant workflow disruption — respond within 2 hours
- MEDIUM: Feature not working as expected, workaround available — respond within 24 hours
- LOW: General questions, feature requests, cosmetic issues — respond within 72 hours

Team routing:
- ENGINEERING: Technical bugs, API issues, performance problems, integration failures
- BILLING: Payment issues, subscription changes, invoices, refunds
- SALES: Upgrade requests, pricing questions, enterprise inquiries, churn risk
- GENERAL: General questions, documentation requests, how-to questions

Auto-response rules:
- shouldAutoRespond: true for LOW and MEDIUM priority with clear resolutions
- shouldAutoRespond: false for CRITICAL and HIGH (needs human review)
- Always provide a helpful, empathetic autoResponse regardless of shouldAutoRespond

You MUST respond with valid JSON only. No markdown, no explanation outside the JSON structure.

Required JSON format:
{
  "priority": "<CRITICAL|HIGH|MEDIUM|LOW>",
  "team": "<ENGINEERING|BILLING|GENERAL|SALES>",
  "summary": "<2-3 sentence summary of the issue for the support agent>",
  "autoResponse": "<professional, empathetic response to send to the customer>",
  "shouldAutoRespond": <true|false>,
  "estimatedResolutionTime": "<e.g., '2 hours', '24 hours', '3 business days'>",
  "tags": ["<tag1>", "<tag2>"]
}`;

  const user = `Please triage this support ticket:

Ticket ID: ${ticket.id}
Subject: ${ticket.subject}
Customer Email: ${ticket.customerEmail}
${ticket.priority ? `Reported Priority: ${ticket.priority}` : ''}
${ticket.category ? `Category: ${ticket.category}` : ''}
${ticket.previousTickets !== undefined ? `Previous Tickets from Customer: ${ticket.previousTickets}` : ''}
${ticket.attachments && ticket.attachments.length > 0 ? `Attachments: ${ticket.attachments.join(', ')}` : ''}

Customer Message:
---
${ticket.message}
---

Analyze this ticket and provide your triage assessment in the required JSON format.`;

  return { system, user };
}

// ─── Content Generation Prompt ────────────────────────────────────────────────

export function contentGenerationPrompt(request: ContentRequest): PromptPack {
  const contentTypeInstructions: Record<string, string> = {
    blog: `Write a comprehensive blog post with:
- Engaging headline that includes primary keyword
- Introduction that hooks the reader with a compelling question or statistic
- 4-6 well-structured sections with clear subheadings
- Practical examples and actionable insights
- Strong conclusion with key takeaways
- Natural keyword integration (avoid keyword stuffing)`,
    email: `Write a high-converting marketing email with:
- Subject line (included in title field) that drives opens
- Personalized opening that addresses pain points
- Clear value proposition in the first paragraph
- Social proof or credibility elements
- Single, clear call-to-action
- Professional signature block`,
    social: `Write engaging social media content with:
- Hook in the first line (most critical for engagement)
- Value-packed content appropriate for the platform
- Conversational tone that drives engagement
- Strategic hashtags (for LinkedIn/Twitter/Instagram)
- Clear call-to-action
- Optimal length for the platform`,
  };

  const system = `You are an expert content strategist and copywriter with 10+ years of experience creating high-performing B2B content. You specialize in SEO-optimized content that drives engagement, builds authority, and converts readers into customers.

Content creation guidelines:
${contentTypeInstructions[request.type]}

Writing principles:
- Lead with value, not features
- Use active voice and strong verbs
- Break up text with formatting for readability
- Include specific, concrete examples
- Address reader pain points directly
- Maintain consistent brand voice throughout

You MUST respond with valid JSON only. No markdown code blocks, no explanation outside the JSON structure.

Required JSON format:
{
  "title": "<compelling title/headline>",
  "content": "<full content with proper formatting using \\n for newlines>",
  "excerpt": "<2-3 sentence compelling summary for previews and meta descriptions>",
  "seoKeywords": ["<primary keyword>", "<secondary keyword 1>", "<secondary keyword 2>"],
  "estimatedReadTime": "<e.g., '5 min read'>",
  "wordCount": <integer>,
  "metaDescription": "<150-160 character meta description for SEO>",
  "hashtags": ["<#hashtag1>", "<#hashtag2>"],
  "callToAction": "<specific CTA text>"
}`;

  const user = `Please create ${request.type} content with the following specifications:

Topic: ${request.topic}
Target Audience: ${request.targetAudience}
Tone: ${request.tone}
Primary Keywords: ${request.keywords.join(', ')}
${request.wordCount ? `Target Word Count: ${request.wordCount} words` : ''}
${request.includeCallToAction !== undefined ? `Include Call-to-Action: ${request.includeCallToAction}` : ''}
${request.brandVoice ? `Brand Voice Notes: ${request.brandVoice}` : ''}

Create high-quality, original content that serves the target audience and achieves strong SEO performance. Provide your response in the required JSON format.`;

  return { system, user };
}

