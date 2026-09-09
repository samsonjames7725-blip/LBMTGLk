import type { ZodType } from 'zod';
import { isGeminiConfigured } from './models';
import { GeminiProvider } from './gemini';

export interface GenerateOptions {
  system?: string;
  maxTokens?: number;
  json?: boolean;
}

/**
 * Provider-agnostic AI interface (spec §5, §33). Implementations must never
 * receive or return secrets, and must degrade honestly when unconfigured.
 * Gemini is the primary engine; additional providers can be added behind the
 * same interface without touching business logic.
 */
export interface AIProvider {
  readonly name: string;
  readonly configured: boolean;
  readonly model: string;
  generateText(prompt: string, opts?: GenerateOptions): Promise<string>;
  classify(input: string, labels: readonly string[]): Promise<{ label: string; confidence: number }>;
  structuredOutput<T>(prompt: string, schema: ZodType<T>, opts?: GenerateOptions): Promise<T>;
  /** Semantic embeddings — optional capability (used by knowledge retrieval). */
  embed?(texts: string[]): Promise<number[][]>;
}

export class AIProviderError extends Error {
  readonly code = 'AI_PROVIDER_ERROR';
}

const NVIDIA_REQUEST_TIMEOUT_MS = 30_000;

/**
 * NVIDIA provider — OpenAI-compatible chat completions API
 * (https://integrate.api.nvidia.com). Server-side only; the API key is read
 * from the environment and never leaves this module (spec §33/§34).
 */
export class NVIDIAProvider implements AIProvider {
  readonly name = 'nvidia';
  readonly configured = true;
  readonly model: string;

  constructor(model?: string) {
    this.model = model || 'meta/llama-3.1-8b-instruct';
  }

  private async chat(messages: { role: string; content: string }[], json: boolean, maxTokens: number): Promise<string> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), NVIDIA_REQUEST_TIMEOUT_MS);
    try {
      const response = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.NVIDIA_API_KEY ?? ''}`,
        },
        body: JSON.stringify({
          model: this.model,
          messages,
          temperature: json ? 0.1 : 0.5,
          top_p: 0.9,
          max_tokens: maxTokens,
          ...(json ? { response_format: { type: 'json_object' } } : {}),
        }),
      });
      if (!response.ok) {
        throw new AIProviderError(`NVIDIA API request failed with status ${response.status}`);
      }
      const payload = (await response.json()) as { choices?: { message?: { content?: string } }[] };
      const content = payload.choices?.[0]?.message?.content;
      if (!content) throw new AIProviderError('NVIDIA API returned an empty response');
      return content;
    } finally {
      clearTimeout(timer);
    }
  }

  async generateText(prompt: string, opts: GenerateOptions = {}): Promise<string> {
    const messages: { role: string; content: string }[] = [];
    if (opts.system) messages.push({ role: 'system', content: opts.system });
    messages.push({ role: 'user', content: prompt });
    return this.chat(messages, Boolean(opts.json), opts.maxTokens ?? 800);
  }

  async classify(input: string, labels: readonly string[]) {
    const raw = await this.chat(
      [
        {
          role: 'system',
          content:
            'You are a strict classifier. Reply with ONLY a JSON object of the form {"label": "<one of the allowed labels>", "confidence": <0..1>}.',
        },
        { role: 'user', content: `Allowed labels: ${labels.join(', ')}\n\nInput: ${input}` },
      ],
      true,
      100,
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
    const raw = await this.generateText(prompt, { ...opts, json: true });
    const candidate = extractJsonObject(raw);
    const parsed = schema.safeParse(candidate);
    if (!parsed.success) {
      throw new AIProviderError('AI response did not match the expected structure');
    }
    return parsed.data;
  }
}

/** Extracts the first JSON object substring from model output. */
export function extractJsonObject(text: string): Record<string, unknown> | undefined {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end <= start) return undefined;
  try {
    return JSON.parse(text.slice(start, end + 1)) as Record<string, unknown>;
  } catch {
    return undefined;
  }
}

/**
 * Deterministic fallback used when Gemini is NOT configured (spec §99). All
 * outputs are clearly marked so no one mistakes them for model output.
 */
export class StubProvider implements AIProvider {
  readonly name = 'stub';
  readonly configured = false;
  readonly model = 'not-configured';

  private readonly marker = '[AI Provider: NOT CONFIGURED — deterministic template output]';

  async generateText(prompt: string, _opts?: GenerateOptions): Promise<string> {
    return `${this.marker}\n\n${prompt.slice(0, 400)}\n\n(Configure GEMINI_API_KEY / GEMINI_MODEL to enable generated content.)`;
  }

  async classify(input: string, labels: readonly string[]) {
    return { label: classifyByKeyword(input, labels), confidence: 0.4 };
  }

  async structuredOutput<T>(_prompt: string, _schema: ZodType<T>, _opts?: GenerateOptions): Promise<T> {
    // Cannot fabricate structured model output — surface the honest error.
    throw new AIProviderError(`${this.marker} structured output unavailable`);
  }
}

/**
 * Shared keyword intent classifier used by the Manager as a deterministic
 * fallback (and always when no provider is configured).
 */
export function classifyByKeyword(input: string, labels: readonly string[]): string {
  const text = input.toLowerCase();
  const keywords: Record<string, string[]> = {
    lead: ['lead', 'prospect', 'hot', 'score', 'qualification', 'website enquiry', 'contact first'],
    sales: ['pipeline', 'opportunit', 'deal', 'sales', 'revenue', 'close', 'negotiation'],
    followup: ['follow-up', 'followup', 'overdue', 'reminder', 'pending follow'],
    email: ['email', 'draft', 'mail', 'write to'],
    proposal: ['proposal', 'quotation', 'quote', 'rfp', 'tender'],
    analytics: ['analytics', 'conversion', 'source performance', 'metrics'],
    report: ['report', 'summary', 'management', 'ceo', 'daily'],
    customer_success: ['customer success', 'churn', 'reactivat', 'satisfaction'],
  };
  for (const label of labels) {
    for (const keyword of keywords[label] ?? []) {
      if (text.includes(keyword)) return label;
    }
  }
  return labels[labels.length - 1];
}

let cached: AIProvider | null = null;

/**
 * Provider factory (spec §33): NVIDIA first (primary engine per the master
 * build spec), then Google Gemini, then the deterministic stub. Providers are
 * interchangeable behind the AIProvider interface.
 */
export function getAIProvider(): AIProvider {
  if (!cached) {
    if (process.env.NVIDIA_API_KEY) {
      cached = new NVIDIAProvider(process.env.NVIDIA_MODEL);
    } else if (isGeminiConfigured()) {
      cached = new GeminiProvider();
    } else {
      cached = new StubProvider();
    }
  }
  return cached;
}

export function resetAIProviderForTests(): void {
  cached = null;
}
