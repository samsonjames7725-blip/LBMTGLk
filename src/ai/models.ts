/**
 * Gemini model registry (spec §5). Models are configured through environment
 * variables and never hardcoded at call sites, so a model upgrade is an env
 * change, not a code change. Server-side only.
 */
export type ModelPurpose = 'default' | 'fast' | 'reasoning' | 'embedding';

const DEFAULT_MODELS: Record<ModelPurpose, string> = {
  default: 'gemini-2.5-flash',
  fast: 'gemini-2.5-flash-lite',
  reasoning: 'gemini-2.5-pro',
  embedding: 'gemini-embedding-001',
};

const MODEL_ENV_VARS: Record<ModelPurpose, string> = {
  default: 'GEMINI_MODEL',
  fast: 'GEMINI_FAST_MODEL',
  reasoning: 'GEMINI_REASONING_MODEL',
  embedding: 'GEMINI_EMBEDDING_MODEL',
};

/** Resolves the model for a purpose; env override wins over the default. */
export function resolveModel(purpose: ModelPurpose = 'default'): string {
  const fromEnv = process.env[MODEL_ENV_VARS[purpose]];
  return (fromEnv ?? '').trim() || DEFAULT_MODELS[purpose];
}

export function isGeminiConfigured(): boolean {
  return Boolean(process.env.GEMINI_API_KEY);
}
