import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';

const MAX_RETRIES = 3;
const RETRY_DELAYS_MS = [1000, 2000, 4000] as const;
const RATE_LIMIT_DELAY_MS = 12000;

// ─── Singleton client ─────────────────────────────────────────────────────────

let _client: Anthropic | null = null;

export const getAnthropicClient = (): Anthropic => {
  if (!_client) {
    _client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return _client;
};

export const getModel = (): string => process.env.CLAUDE_MODEL || 'claude-sonnet-4-6';

const shouldUseMockLlm = (): boolean => {
  const noApiKey = !process.env.ANTHROPIC_API_KEY;
  const mockNotDisabled = process.env.USE_MOCK_INTEGRATIONS !== 'false';
  return noApiKey && mockNotDisabled;
};

const asText = (content: Anthropic.MessageParam['content']): string => {
  if (typeof content === 'string') return content;
  return content
    .map((part) => (part.type === 'text' ? part.text : ''))
    .join(' ')
    .trim();
};

const buildMockSalesResult = (userText: string): unknown => {
  const lower = userText.toLowerCase();
  const hasBudget = /\$|budget|approved|enterprise/.test(lower);
  const hasUrgency = /urgent|asap|this quarter|timeline|immediately/.test(lower);
  const score = hasBudget && hasUrgency ? 88 : hasBudget ? 76 : 62;
  const tier = score >= 80 ? 'HOT' : score >= 70 ? 'WARM' : 'COLD';

  return {
    score,
    tier,
    reasoning: 'Mock qualification result generated locally because Anthropic API key is not configured.',
    nextAction:
      tier === 'HOT'
        ? 'Create Salesforce lead and auto-schedule discovery call.'
        : 'Create Salesforce lead and route to SDR for follow-up.',
    keyInsights: [
      hasBudget ? 'Budget intent detected in lead message.' : 'Budget not explicit; qualification confidence reduced.',
      hasUrgency ? 'Urgency/timeline intent detected.' : 'No urgent timeline detected.',
    ],
    estimatedDealSize: tier === 'HOT' ? '$60k-$120k ARR' : '$20k-$60k ARR',
  };
};

const buildMockSupportResult = (userText: string): unknown => {
  const lower = userText.toLowerCase();
  const isCritical = /outage|down|cannot login|payment failure|production/.test(lower);
  const isBilling = /invoice|billing|charge|refund|payment/.test(lower);

  return {
    priority: isCritical ? 'CRITICAL' : 'HIGH',
    team: isBilling ? 'BILLING' : 'ENGINEERING',
    summary: 'Mock triage result generated locally because Anthropic API key is not configured.',
    autoResponse: isBilling
      ? 'Thanks for contacting billing support. We are reviewing your request and will follow up shortly.'
      : 'Thanks for reporting this issue. Engineering has been notified and we are investigating now.',
    shouldAutoRespond: true,
    estimatedResolutionTime: isCritical ? '1-2 hours' : '4-8 hours',
    tags: isBilling ? ['billing', 'priority-high'] : ['technical', 'priority-high'],
  };
};

const buildMockContentResult = (userText: string): unknown => {
  const topicMatch = userText.match(/topic[:\s]+([^\n]+)/i);
  const topic = topicMatch?.[1]?.trim() || 'Agentic workflows';

  return {
    title: `How ${topic} accelerates modern teams`,
    excerpt: `A practical overview of ${topic} with implementation tips and measurable outcomes.`,
    content: `# How ${topic} accelerates modern teams\n\n${topic} helps teams reduce manual work, improve consistency, and ship outcomes faster. Start with one workflow, measure quality and latency, then scale with observability and strict validation.\n\n## Why it matters\n- Faster cycle time\n- Higher execution consistency\n- Better operational visibility\n\n## Next steps\nPilot one high-impact process, define success metrics, and iterate weekly based on telemetry.`,
    seoKeywords: ['agentic workflows', 'automation', 'ai operations'],
    estimatedReadTime: '3 min',
    wordCount: 120,
    metaDescription: `Learn how ${topic} can improve execution speed and quality in your organization.`,
    hashtags: ['#AI', '#Automation', '#DeveloperTools'],
    callToAction: 'Run a small pilot workflow this week and track success rate + latency.',
  };
};

const buildMockResult = (params: Anthropic.MessageCreateParamsNonStreaming): unknown => {
  const system = params.system;
  const systemText = Array.isArray(system) ? system.map((p) => (typeof p === 'string' ? p : p.text)).join('\n') : (system || '');
  const userText = params.messages
    .filter((m) => m.role === 'user')
    .map((m) => asText(m.content))
    .join('\n');

  if (systemText.includes('PromptVersion: sales-qualifier/')) {
    return buildMockSalesResult(userText);
  }
  if (systemText.includes('PromptVersion: support-triage/')) {
    return buildMockSupportResult(userText);
  }
  if (systemText.includes('PromptVersion: content-generator/')) {
    return buildMockContentResult(userText);
  }

  return { message: 'Mock response unavailable for this prompt version.' };
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

const isRateLimitError = (msg: string): boolean => {
  const lower = msg.toLowerCase();
  return lower.includes('429') || lower.includes('rate limit') || lower.includes('rate_limit');
};

export const extractJSON = (text: string): string => {
  const codeBlock = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlock) return codeBlock[1].trim();
  const jsonObj = text.match(/\{[\s\S]*\}/);
  if (jsonObj) return jsonObj[0].trim();
  return text.trim();
};

// ─── Retry runner ─────────────────────────────────────────────────────────────

export interface ClaudeRunResult<T> {
  result: T;
  tokensUsed: number;
  retryCount: number;
}

export async function runWithRetry<T>(
  params: Anthropic.MessageCreateParamsNonStreaming,
  schema: z.ZodType<T>,
  defaultError: string
): Promise<ClaudeRunResult<T>> {
  if (shouldUseMockLlm()) {
    const mock = buildMockResult(params);
    const validated = schema.safeParse(mock);
    if (!validated.success) {
      const details = validated.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join(', ');
      throw new Error(`Mock LLM validation failed: ${details}`);
    }

    return {
      result: validated.data,
      tokensUsed: 0,
      retryCount: 0,
    };
  }

  const client = getAnthropicClient();
  let tokensUsed = 0;
  let retryCount = 0;
  let lastError = defaultError;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      retryCount++;
      const delay = isRateLimitError(lastError)
        ? RATE_LIMIT_DELAY_MS
        : (RETRY_DELAYS_MS[attempt - 1] ?? 4000);
      await sleep(delay);
    }

    try {
      const response = await client.messages.create(params);
      tokensUsed = response.usage.input_tokens + response.usage.output_tokens;
      const raw = response.content[0];

      if (raw.type !== 'text') {
        lastError = 'Unexpected non-text response from model';
        continue;
      }

      const parsed = JSON.parse(extractJSON(raw.text)) as unknown;
      const validated = schema.safeParse(parsed);

      if (!validated.success) {
        lastError = validated.error.errors
          .map((e) => `${e.path.join('.')}: ${e.message}`)
          .join(', ');
        continue;
      }

      return { result: validated.data, tokensUsed, retryCount };
    } catch (error) {
      lastError = String(error);
    }
  }

  throw new Error(lastError);
}
