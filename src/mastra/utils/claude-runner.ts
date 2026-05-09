import OpenAI from 'openai';
import { z } from 'zod';

const MAX_RETRIES = 3;
const RETRY_DELAYS_MS = [1000, 2000, 4000] as const;
const RATE_LIMIT_DELAY_MS = 12000;

// ─── Singleton client ─────────────────────────────────────────────────────────

let _client: OpenAI | null = null;

export const getOpenAIClient = (): OpenAI => {
  if (!_client) {
    _client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return _client;
};

export const getModel = (): string => process.env.OPENAI_MODEL || 'gpt-4o-mini';

const shouldUseMockLlm = (): boolean => {
  const noApiKey = !process.env.OPENAI_API_KEY;
  const mockNotDisabled = process.env.USE_MOCK_INTEGRATIONS !== 'false';
  return noApiKey && mockNotDisabled;
};

// ─── Mock result builders ─────────────────────────────────────────────────────

const buildMockSalesResult = (userText: string): unknown => {
  const lower = userText.toLowerCase();
  // Detect budget — explicit negations must come first to avoid false positives
  const hasBudgetNegation = /no budget|don't have budget|do not have budget|without budget|\$0 budget|zero budget/.test(lower);
  const hasBudget = !hasBudgetNegation && /\$\d|\bbudget\b.*\b(approved|sorted|ready|confirmed)\b|\b(approved|sorted|confirmed)\b.*\bbudget\b|enterprise plan/.test(lower);
  // Detect urgency — avoid matching "no urgency", "not urgent", etc.
  const hasUrgencyNegation = /no urgency|not urgent|no rush|no timeline/.test(lower);
  const hasUrgency = !hasUrgencyNegation && /urgent|asap|this quarter|this week|end of month|immediately/.test(lower);

  const score = hasBudget && hasUrgency ? 88 : hasBudget ? 76 : hasUrgency ? 65 : 55;
  const tier = score >= 80 ? 'HOT' : score >= 60 ? 'WARM' : score >= 40 ? 'COLD' : 'UNQUALIFIED';
  const confidence = hasBudget && hasUrgency ? 'HIGH' : hasBudget || hasUrgency ? 'MEDIUM' : 'LOW';

  return {
    score,
    tier,
    confidence,
    reasoning: `Budget: ${hasBudget ? 'confirmed' : 'missing'} — ${hasBudget ? 'budget signal detected' : 'no budget signal found'}. Authority: unclear — not evaluated in mock mode. Need: assumed present. Timeline: ${hasUrgency ? 'confirmed — urgency signal detected' : 'missing — no urgency signal found'}. Mock result generated locally (no OpenAI API key).`,
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
  // Match outage / system-down signals — includes standalone "down" (e.g. "checkout's down")
  const isCritical =
    /outage|payment failure|production/.test(lower) ||
    /\bdown\b/.test(lower);
  // Login broken after password reset = system-level auth bug → HIGH
  const isAuthBug =
    /(cannot|can not|can't|unable to)\s+(log\s?in|login|sign\s?in)/.test(lower) ||
    (/password/.test(lower) && /(reset|incorrect|wrong|not working|still)/.test(lower));
  const isBilling = /invoice|billing|charge|refund|payment/.test(lower);

  const priority: string = isCritical ? 'CRITICAL' : isAuthBug || isBilling ? 'HIGH' : 'MEDIUM';

  return {
    priority,
    team: isBilling ? 'BILLING' : 'ENGINEERING',
    summary: 'Mock triage result generated locally because OpenAI API key is not configured.',
    autoResponse: isBilling
      ? 'Thanks for contacting billing support. We are reviewing your request and will follow up shortly.'
      : 'Thanks for reporting this issue. Engineering has been notified and we are investigating now.',
    shouldAutoRespond: true,
    estimatedResolutionTime: isCritical ? '1-2 hours' : '4-8 hours',
    tags: isBilling ? ['billing', 'priority-high'] : ['technical', 'priority-high'],
  };
};

const buildMockContentResult = (userText: string): unknown => {
  // Match "topic: X" or "about X" (up to punctuation/newline) — handles formal and casual phrasing
  const topicMatch =
    userText.match(/topic[:\s]+([^\n,]+)/i) ||
    userText.match(/(?:post|write|blog|content)\s+(?:about|on)\s+([^,\n.!?]+)/i);
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

const buildMockResult = (params: LLMParams): unknown => {
  const systemText = params.system;
  const userText = params.messages
    .filter((m) => m.role === 'user')
    .map((m) => m.content)
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

// ─── Param type (OpenAI-compatible) ──────────────────────────────────────────

export interface LLMParams {
  model: string;
  max_tokens: number;
  system: string;
  messages: Array<{ role: 'user' | 'assistant'; content: string }>;
}

// ─── Retry runner ─────────────────────────────────────────────────────────────

export interface ClaudeRunResult<T> {
  result: T;
  tokensUsed: number;
  retryCount: number;
}

export async function runWithRetry<T>(
  params: LLMParams,
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

  const client = getOpenAIClient();
  let tokensUsed = 0;
  let retryCount = 0;
  let lastError = defaultError;

  // Build OpenAI messages array: system message + user messages
  const openAiMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: 'system', content: params.system },
    ...params.messages.map((m) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    })),
  ];

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      retryCount++;
      const delay = isRateLimitError(lastError)
        ? RATE_LIMIT_DELAY_MS
        : (RETRY_DELAYS_MS[attempt - 1] ?? 4000);
      await sleep(delay);
    }

    try {
      const response = await client.chat.completions.create({
        model: params.model,
        max_tokens: params.max_tokens,
        messages: openAiMessages,
      });

      tokensUsed = (response.usage?.prompt_tokens ?? 0) + (response.usage?.completion_tokens ?? 0);
      const rawText = response.choices[0]?.message?.content ?? '';

      let parsed: unknown;
      try {
        parsed = JSON.parse(extractJSON(rawText));
      } catch {
        lastError = `JSON parse failed on attempt ${attempt + 1}: model returned non-JSON content: "${rawText.slice(0, 200)}"`;
        continue;
      }

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
