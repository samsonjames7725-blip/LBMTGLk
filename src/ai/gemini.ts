import type { ZodType } from 'zod';
import { AIProviderError, extractJsonObject, type GenerateOptions } from './provider';
import { resolveModel } from './models';

const REQUEST_TIMEOUT_MS = 30_000;
const API_BASE = 'https://generativelanguage.googleapis.com/v1beta';

interface GeminiPart {
  text?: string;
}

interface GeminiGenerateResponse {
  candidates?: { content?: { parts?: GeminiPart[] }; finishReason?: string }[];
  promptFeedback?: { blockReason?: string };
}

interface GeminiEmbedResponse {
  embeddings?: { values?: number[] }[];
}

/**
 * Gemini provider — Google Generative Language REST API. Server-side only;
 * the API key is read from the environment and never leaves this module or
 * appears in error messages. Structured outputs use the API's JSON response
 * mode plus application-side Zod validation, so the schema stays the source
 * of truth (spec §5, §63).
 */
export class GeminiProvider {
  readonly name = 'gemini';
  readonly configured = true;
  readonly model: string;

  constructor(model?: string) {
    this.model = model || resolveModel('default');
  }

  private async generate(
    prompt: string,
    opts: GenerateOptions,
    purpose: 'default' | 'fast' | 'reasoning',
  ): Promise<string> {
    const model = purpose === 'default' ? this.model : resolveModel(purpose);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const response = await fetch(`${API_BASE}/models/${encodeURIComponent(model)}:generateContent`, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': process.env.GEMINI_API_KEY ?? '',
        },
        body: JSON.stringify({
          ...(opts.system ? { systemInstruction: { parts: [{ text: opts.system }] } } : {}),
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: opts.json ? 0.1 : 0.5,
            topP: 0.9,
            maxOutputTokens: opts.json ? 4096 : (opts.maxTokens ?? 2048),
            ...(opts.json ? { responseMimeType: 'application/json' } : {}),
          },
        }),
      });
      if (!response.ok) {
        throw new AIProviderError(`Gemini API request failed with status ${response.status}`);
      }
      const payload = (await response.json()) as GeminiGenerateResponse;
      if (payload.promptFeedback?.blockReason) {
        throw new AIProviderError('Gemini request was blocked by safety filters');
      }
      const text = payload.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('').trim();
      if (!text) throw new AIProviderError('Gemini API returned an empty response');
      return text;
    } catch (error) {
      if (error instanceof AIProviderError) throw error;
      if (error instanceof Error && error.name === 'AbortError') {
        throw new AIProviderError('Gemini API request timed out');
      }
      throw new AIProviderError('Gemini API request failed');
    } finally {
      clearTimeout(timer);
    }
  }

  async generateText(prompt: string, opts: GenerateOptions = {}): Promise<string> {
    return this.generate(prompt, opts, 'default');
  }

  async classify(input: string, labels: readonly string[]): Promise<{ label: string; confidence: number }> {
    const raw = await this.generate(
      `Allowed labels: ${labels.join(', ')}\n\nInput: ${input}`,
      {
        system:
          'You are a strict classifier. Reply with ONLY a JSON object of the form {"label": "<one of the allowed labels>", "confidence": <0..1>}.',
        json: true,
        maxTokens: 256,
      },
      'fast',
    );
    let parsed: { label?: string; confidence?: number };
    try {
      parsed = JSON.parse(raw) as { label?: string; confidence?: number };
    } catch {
      parsed = { label: extractJsonObject(raw)?.label as string | undefined };
    }
    const label = labels.includes(parsed.label ?? '') ? parsed.label! : labels[labels.length - 1];
    const confidence = typeof parsed.confidence === 'number' ? Math.min(1, Math.max(0, parsed.confidence)) : 0.5;
    return { label, confidence };
  }

  async structuredOutput<T>(prompt: string, schema: ZodType<T>, opts: GenerateOptions = {}): Promise<T> {
    const raw = await this.generate(prompt, { ...opts, json: true }, 'default');
    const candidate = extractJsonObject(raw);
    const parsed = schema.safeParse(candidate);
    if (!parsed.success) {
      throw new AIProviderError('AI response did not match the expected structure');
    }
    return parsed.data;
  }

  /** Semantic embeddings for company-knowledge retrieval (spec §38). */
  async embed(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return [];
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const model = resolveModel('embedding');
      const response = await fetch(`${API_BASE}/models/${encodeURIComponent(model)}:batchEmbedContents`, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': process.env.GEMINI_API_KEY ?? '',
        },
        body: JSON.stringify({
          requests: texts.map((text) => ({
            model: `models/${model}`,
            content: { parts: [{ text }] },
          })),
        }),
      });
      if (!response.ok) {
        throw new AIProviderError(`Gemini embedding request failed with status ${response.status}`);
      }
      const payload = (await response.json()) as GeminiEmbedResponse;
      const embeddings = payload.embeddings?.map((e) => e.values ?? []);
      if (!embeddings || embeddings.length !== texts.length) {
        throw new AIProviderError('Gemini embedding response was incomplete');
      }
      return embeddings;
    } finally {
      clearTimeout(timer);
    }
  }
}
