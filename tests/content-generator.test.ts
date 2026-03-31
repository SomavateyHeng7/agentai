import { describe, expect, it } from '@jest/globals';
import { ContentRequestSchema, ContentResultSchema } from '../src/types';
import { contentGenerationPrompt } from '../src/prompts';

describe('content generator contracts', () => {
  it('validates a well-formed content request', () => {
    const request = {
      type: 'blog',
      topic: 'AI Automation for B2B Sales Teams',
      targetAudience: 'RevOps leaders at SaaS companies',
      tone: 'professional',
      keywords: ['ai automation', 'sales ops', 'revops'],
    };

    const parsed = ContentRequestSchema.safeParse(request);
    expect(parsed.success).toBe(true);
  });

  it('rejects a request with no keywords', () => {
    const parsed = ContentRequestSchema.safeParse({
      type: 'email',
      topic: 'Product Launch',
      targetAudience: 'Developers',
      tone: 'casual',
      keywords: [],
    });
    expect(parsed.success).toBe(false);
  });

  it('rejects an invalid content type', () => {
    const parsed = ContentRequestSchema.safeParse({
      type: 'podcast',
      topic: 'AI trends',
      targetAudience: 'Tech leaders',
      tone: 'professional',
      keywords: ['ai'],
    });
    expect(parsed.success).toBe(false);
  });

  it('builds prompt pack with required JSON instructions', () => {
    const prompt = contentGenerationPrompt({
      type: 'social',
      topic: 'Launch of our new AI feature',
      targetAudience: 'SaaS founders',
      tone: 'inspirational',
      keywords: ['ai', 'product launch'],
    });

    expect(prompt.system).toContain('You MUST respond with valid JSON only');
    expect(prompt.user).toContain('Please create social content');
  });

  it('validates a well-formed content result', () => {
    const result = {
      title: '5 Ways AI Is Transforming B2B Sales',
      content: 'AI is reshaping how sales teams qualify leads and close deals...',
      excerpt: 'Discover how AI tools are helping B2B sales teams work smarter.',
      seoKeywords: ['ai sales', 'b2b automation', 'sales ops'],
      estimatedReadTime: '4 min read',
      wordCount: 800,
    };

    const parsed = ContentResultSchema.safeParse(result);
    expect(parsed.success).toBe(true);
  });

  it('rejects a result with zero word count', () => {
    const result = {
      title: 'Empty Article',
      content: 'Some content here.',
      excerpt: 'A short excerpt.',
      seoKeywords: ['test'],
      estimatedReadTime: '1 min read',
      wordCount: 0,
    };

    const parsed = ContentResultSchema.safeParse(result);
    expect(parsed.success).toBe(false);
  });
});
