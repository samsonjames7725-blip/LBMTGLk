import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { classifyByKeyword, extractJsonObject, getAIProvider, resetAIProviderForTests, StubProvider } from '@/ai/provider';
import { GeminiProvider } from '@/ai/gemini';
import { z } from 'zod';

const LABELS = ['lead', 'sales', 'followup', 'email', 'report', 'unknown'] as const;

describe('extractJsonObject', () => {
  it('parses a clean JSON object', () => {
    expect(extractJsonObject('{"label":"lead"}')).toEqual({ label: 'lead' });
  });

  it('extracts JSON embedded in prose or markdown fences', () => {
    expect(extractJsonObject('Here you go:\n```json\n{"a":1}\n```')).toEqual({ a: 1 });
  });

  it('returns undefined for non-JSON text', () => {
    expect(extractJsonObject('no json here')).toBeUndefined();
    expect(extractJsonObject('{broken')).toBeUndefined();
  });
});

describe('classifyByKeyword', () => {
  it('routes follow-up language to the followup label', () => {
    expect(classifyByKeyword('show overdue follow-ups', [...LABELS])).toBe('followup');
  });

  it('routes report language to the report label', () => {
    expect(classifyByKeyword('prepare a daily management report', [...LABELS])).toBe('report');
  });

  it('falls back to the last label when nothing matches', () => {
    expect(classifyByKeyword('xyzzy', [...LABELS])).toBe('unknown');
  });
});

function geminiResponse(text: string, status = 200): Response {
  return new Response(status === 200 ? JSON.stringify({ candidates: [{ content: { parts: [{ text }] } }] }) : 'error', {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('GeminiProvider', () => {
  beforeEach(() => {
    vi.stubEnv('GEMINI_API_KEY', 'test-key');
    vi.stubEnv('GEMINI_MODEL', 'gemini-test-model');
    vi.stubEnv('GEMINI_FAST_MODEL', 'gemini-test-fast');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('sends JSON mode and the API key header; parses the response text', async () => {
    const fetchMock = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as { generationConfig?: Record<string, unknown> };
      expect(body.generationConfig?.responseMimeType).toBe('application/json');
      expect((init?.headers as Record<string, string>)['x-goog-api-key']).toBe('test-key');
      return geminiResponse('{"label":"lead","confidence":0.9}');
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await new GeminiProvider().classify('show me hot leads', [...LABELS]);
    expect(result).toEqual({ label: 'lead', confidence: 0.9 });
    expect(String(fetchMock.mock.calls[0][0])).toContain('/v1beta/models/gemini-test-fast:generateContent');
  });

  it('uses the configured default model for generateText', async () => {
    const fetchMock = vi.fn(async (..._args: unknown[]) => geminiResponse('hello'));
    vi.stubGlobal('fetch', fetchMock);
    const provider = new GeminiProvider();
    expect(provider.model).toBe('gemini-test-model');
    await expect(provider.generateText('hi')).resolves.toBe('hello');
    expect(String(fetchMock.mock.calls[0][0])).toContain('/v1beta/models/gemini-test-model:generateContent');
  });

  it('validates structured output against the schema and rejects mismatches', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => geminiResponse('{"order":["not-a-uuid"],"rationale":"r"}')));
    const schema = z.object({ order: z.array(z.string().uuid()), rationale: z.string() });
    await expect(new GeminiProvider().structuredOutput('prioritize', schema)).rejects.toThrow(/expected structure/);
  });

  it('surfaces provider failures without leaking the key', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => geminiResponse('blocked', 401)));
    await expect(new GeminiProvider().generateText('hi')).rejects.toThrow(/status 401/);
    let caught: string | null = null;
    try {
      await new GeminiProvider().generateText('hi');
    } catch (e) {
      caught = e instanceof Error ? e.message : String(e);
    }
    expect(caught).toBeTruthy();
    expect(caught).not.toContain('test-key');
  });

  it('embeds texts via batchEmbedContents', async () => {
    vi.stubEnv('GEMINI_EMBEDDING_MODEL', 'embedding-test');
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(JSON.stringify({ embeddings: [{ values: [1, 2] }, { values: [3, 4] }] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      ),
    );
    const vectors = await new GeminiProvider().embed(['a', 'b']);
    expect(vectors).toEqual([[1, 2], [3, 4]]);
  });
});

describe('provider factory', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    resetAIProviderForTests();
  });

  it('uses the deterministic stub when Gemini is not configured', () => {
    vi.stubEnv('GEMINI_API_KEY', '');
    resetAIProviderForTests();
    const provider = getAIProvider();
    expect(provider).toBeInstanceOf(StubProvider);
    expect(provider.configured).toBe(false);
    expect(provider.model).toBe('not-configured');
  });

  it('uses Gemini when configured', () => {
    vi.stubEnv('GEMINI_API_KEY', 'test-key');
    resetAIProviderForTests();
    expect(getAIProvider().name).toBe('gemini');
    resetAIProviderForTests();
  });

  it('stub refuses to fabricate structured output', async () => {
    const stub = new StubProvider();
    await expect(stub.structuredOutput('x', z.object({ a: z.number() }))).rejects.toThrow(/NOT CONFIGURED/);
  });
});
