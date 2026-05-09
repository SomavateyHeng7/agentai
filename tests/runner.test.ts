/**
 * Unit tests for the LLM runner utilities.
 *
 * Covers: extractJSON parsing, mock LLM detection per agent type,
 * schema validation after mock, and failure path handling.
 *
 * All tests run offline — no API key required.
 */

import { describe, expect, it, beforeEach, afterEach } from "@jest/globals";
import { extractJSON, runWithRetry } from "../src/mastra/utils/claude-runner";
import {
  SalesQualificationResultSchema,
  SupportTriageResultSchema,
  ContentResultSchema,
} from "../src/types";
import { z } from "zod";

// ─── extractJSON ──────────────────────────────────────────────────────────────

describe("extractJSON", () => {
  it("returns a raw JSON object string unchanged", () => {
    const input = '{"score": 85, "tier": "HOT"}';
    expect(extractJSON(input)).toBe(input);
  });

  it("strips ```json code blocks", () => {
    const input = '```json\n{"score": 72, "tier": "WARM"}\n```';
    expect(extractJSON(input)).toBe('{"score": 72, "tier": "WARM"}');
  });

  it("strips plain ``` code blocks", () => {
    const input = '```\n{"priority": "HIGH"}\n```';
    expect(extractJSON(input)).toBe('{"priority": "HIGH"}');
  });

  it("extracts embedded JSON from surrounding prose", () => {
    const input = 'Here is the result: {"score": 60, "tier": "COLD"} — done!';
    expect(extractJSON(input)).toContain('"score": 60');
  });

  it("trims surrounding whitespace", () => {
    const input = '   {"key": "value"}   ';
    expect(extractJSON(input)).toBe('{"key": "value"}');
  });

  it("returns trimmed text when no JSON object is found", () => {
    expect(extractJSON("  plain text  ")).toBe("plain text");
  });
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

const savedKey = process.env.OPENAI_API_KEY;

const enableMockMode = () => {
  delete process.env.OPENAI_API_KEY;
  process.env.USE_MOCK_INTEGRATIONS = "true";
};

const restoreKey = () => {
  if (savedKey !== undefined) {
    process.env.OPENAI_API_KEY = savedKey;
  }
};

// ─── Mock LLM — Sales Qualifier ───────────────────────────────────────────────

describe("mock LLM — sales qualifier", () => {
  beforeEach(enableMockMode);
  afterEach(restoreKey);

  const makeParams = (content: string) => ({
    model: "gpt-4o-mini",
    max_tokens: 1024,
    system:
      "PromptVersion: sales-qualifier/v1\nYou MUST respond with valid JSON only.",
    messages: [{ role: "user" as const, content }],
  });

  it("scores HOT when budget + urgency signals are present", async () => {
    const { result } = await runWithRetry(
      makeParams(
        "We have $200k budget approved this quarter and need this ASAP.",
      ),
      SalesQualificationResultSchema,
      "error",
    );
    expect(result.tier).toBe("HOT");
    expect(result.score).toBeGreaterThanOrEqual(80);
    expect(result.reasoning).toBeTruthy();
    expect(result.nextAction).toBeTruthy();
  });

  it("scores WARM when budget is present but no urgency", async () => {
    const { result } = await runWithRetry(
      makeParams("We have an enterprise budget approved for automation."),
      SalesQualificationResultSchema,
      "error",
    );
    expect(result.tier).toBe("WARM");
    expect(result.score).toBeGreaterThanOrEqual(70);
    expect(result.score).toBeLessThan(80);
  });

  it("scores COLD when no budget or urgency signals", async () => {
    const { result } = await runWithRetry(
      makeParams("Just browsing your website, no immediate plans."),
      SalesQualificationResultSchema,
      "error",
    );
    expect(result.tier).toBe("COLD");
    expect(result.score).toBeLessThan(70);
  });

  it("handles mixed 50-50 intent by choosing WARM when budget exists without urgency", async () => {
    const { result } = await runWithRetry(
      makeParams(
        "Budget is approved, but we are still evaluating alternatives before committing.",
      ),
      SalesQualificationResultSchema,
      "error",
    );
    expect(result.tier).toBe("WARM");
    expect(result.score).toBe(76);
  });

  it("handles complex multi-message conflict by choosing HOT when budget and urgency appear across turns", async () => {
    const { result } = await runWithRetry(
      {
        model: "gpt-4o-mini",
        max_tokens: 1024,
        system:
          "PromptVersion: sales-qualifier/v1\nYou MUST respond with valid JSON only.",
        messages: [
          {
            role: "user",
            content:
              "We are exploring vendors and have internal concerns about migration risk.",
          },
          {
            role: "user",
            content:
              "Finance approved budget for this quarter and leadership asked for an immediate pilot kickoff.",
          },
        ],
      },
      SalesQualificationResultSchema,
      "error",
    );

    expect(result.tier).toBe("HOT");
    expect(result.score).toBe(88);
    expect(result.reasoning).toBeTruthy();
    expect(result.nextAction).toContain("Create Salesforce lead");
  });

  it("returns tokensUsed=0 and retryCount=0 in mock mode", async () => {
    const { tokensUsed, retryCount } = await runWithRetry(
      makeParams("enterprise budget approved"),
      SalesQualificationResultSchema,
      "error",
    );
    expect(tokensUsed).toBe(0);
    expect(retryCount).toBe(0);
  });

  it("output satisfies the full schema", async () => {
    const { result } = await runWithRetry(
      makeParams("$500k enterprise deal, need to close this quarter"),
      SalesQualificationResultSchema,
      "error",
    );
    expect(SalesQualificationResultSchema.safeParse(result).success).toBe(true);
  });

  it("treats urgency without budget as COLD instead of over-scoring the lead", async () => {
    const { result } = await runWithRetry(
      makeParams(
        "yo this is kinda messy but we need it like yesterday, everyone keeps asking me for updates, and we are just poking around with no spend locked in yet.",
      ),
      SalesQualificationResultSchema,
      "error",
    );

    expect(result.tier).toBe("COLD");
    expect(result.score).toBe(55);
    expect(result.keyInsights).toEqual(
      expect.arrayContaining([
        "Budget not explicit; qualification confidence reduced.",
      ]),
    );
  });

  it("scores HOT for a casual but strong buying message with budget and urgency", async () => {
    const { result } = await runWithRetry(
      makeParams(
        "lol my boss is pushing this, we got budget approved for this quarter, and we need pricing plus next steps asap.",
      ),
      SalesQualificationResultSchema,
      "error",
    );

    expect(result.tier).toBe("HOT");
    expect(result.score).toBe(88);
    expect(result.keyInsights).toEqual(
      expect.arrayContaining([
        "Budget intent detected in lead message.",
        "Urgency/timeline intent detected.",
      ]),
    );
  });
});

// ─── Mock LLM — Support Triage ────────────────────────────────────────────────

describe("mock LLM — support triage", () => {
  beforeEach(enableMockMode);
  afterEach(restoreKey);

  const makeParams = (content: string) => ({
    model: "gpt-4o-mini",
    max_tokens: 1024,
    system:
      "PromptVersion: support-triage/v1\nYou MUST respond with valid JSON only.",
    messages: [{ role: "user" as const, content }],
  });

  it("classifies production outage as CRITICAL / ENGINEERING", async () => {
    const { result } = await runWithRetry(
      makeParams("Production API is down, outage affecting all users."),
      SupportTriageResultSchema,
      "error",
    );
    expect(result.priority).toBe("CRITICAL");
    expect(result.team).toBe("ENGINEERING");
    expect(result.shouldAutoRespond).toBe(true);
  });

  it("classifies billing dispute as HIGH / BILLING", async () => {
    const { result } = await runWithRetry(
      makeParams("I see an incorrect invoice charge on my account."),
      SupportTriageResultSchema,
      "error",
    );
    expect(result.team).toBe("BILLING");
    expect(result.autoResponse).toBeTruthy();
  });

  it("handles 50-50 routing by prioritizing BILLING team during critical billing outage signals", async () => {
    const { result } = await runWithRetry(
      makeParams(
        "Production checkout is down and customers report payment failure with invoice charge errors.",
      ),
      SupportTriageResultSchema,
      "error",
    );
    expect(result.priority).toBe("CRITICAL");
    expect(result.team).toBe("BILLING");
  });

  it("output satisfies the full schema", async () => {
    const { result } = await runWithRetry(
      makeParams("Cannot login after password reset."),
      SupportTriageResultSchema,
      "error",
    );
    expect(SupportTriageResultSchema.safeParse(result).success).toBe(true);
  });

  it("routes a critical billing outage to BILLING while preserving critical priority", async () => {
    const { result } = await runWithRetry(
      makeParams(
        "hey, checkout's down again, payment keeps bouncing, and the invoice/billing stuff looks broken too — super annoying.",
      ),
      SupportTriageResultSchema,
      "error",
    );

    expect(result.priority).toBe("CRITICAL");
    expect(result.team).toBe("BILLING");
    expect(result.tags).toEqual(
      expect.arrayContaining(["billing", "priority-high"]),
    );
  });

  it("routes a casual double-charge complaint to BILLING without over-escalating to CRITICAL", async () => {
    const { result } = await runWithRetry(
      makeParams(
        "hey, pretty sure i got charged twice lol, can someone check the billing side?",
      ),
      SupportTriageResultSchema,
      "error",
    );

    expect(result.priority).toBe("HIGH");
    expect(result.team).toBe("BILLING");
    expect(result.shouldAutoRespond).toBe(true);
  });
});

// ─── Mock LLM — Content Generator ────────────────────────────────────────────

describe("mock LLM — content generator", () => {
  beforeEach(enableMockMode);
  afterEach(restoreKey);

  const makeParams = (content: string) => ({
    model: "gpt-4o-mini",
    max_tokens: 2048,
    system:
      "PromptVersion: content-generator/v1\nYou MUST respond with valid JSON only.",
    messages: [{ role: "user" as const, content }],
  });

  it("generates a title that contains the topic", async () => {
    const { result } = await runWithRetry(
      makeParams("topic: AI-powered sales automation"),
      ContentResultSchema,
      "error",
    );
    expect(result.title).toContain("AI-powered sales automation");
    expect(result.wordCount).toBeGreaterThan(0);
    expect(result.seoKeywords.length).toBeGreaterThan(0);
  });

  it("output satisfies the full schema", async () => {
    const { result } = await runWithRetry(
      makeParams("topic: DevOps automation for startups"),
      ContentResultSchema,
      "error",
    );
    expect(ContentResultSchema.safeParse(result).success).toBe(true);
  });

  it("handles noisy content instructions and still anchors the generated output to the topic", async () => {
    const { result } = await runWithRetry(
      makeParams(
        "yo can you write something on topic: AI governance for regulated fintech\nmake it feel less corporate, explain it like you are talking to the team, and include a clear call to action.",
      ),
      ContentResultSchema,
      "error",
    );

    expect(result.title).toContain("AI governance for regulated fintech");
    expect(result.metaDescription).toContain(
      "AI governance for regulated fintech",
    );
    expect(result.callToAction).toBeTruthy();
    expect(result.hashtags).toEqual(
      expect.arrayContaining(["#AI", "#Automation"]),
    );
  });

  it("handles a casual friend-style request and still extracts the topic cleanly", async () => {
    const { result } = await runWithRetry(
      makeParams(
        "yo can you do a quick post about remote work and AI, keep it chill, not salesy, and make it sound like a friend wrote it.",
      ),
      ContentResultSchema,
      "error",
    );

    expect(result.title).toContain("remote work and AI");
    expect(result.excerpt).toContain("remote work and AI");
    expect(result.wordCount).toBeGreaterThan(0);
  });
});

// ─── Failure paths ────────────────────────────────────────────────────────────

describe("runWithRetry — failure handling", () => {
  beforeEach(enableMockMode);
  afterEach(restoreKey);

  it("throws when mock output does not satisfy the provided schema", async () => {
    const impossibleSchema = z.object({
      nonExistentField: z.string().min(1),
      anotherRequired: z.number().positive(),
    });

    await expect(
      runWithRetry(
        {
          model: "gpt-4o-mini",
          max_tokens: 1024,
          system: "PromptVersion: sales-qualifier/v1\n",
          messages: [{ role: "user", content: "budget approved" }],
        },
        impossibleSchema,
        "validation failed",
      ),
    ).rejects.toThrow("Mock LLM validation failed");
  });
});
