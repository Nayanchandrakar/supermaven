export type InferenceProvider = "openrouter";
export type Role = "system" | "assistant" | "user";

export interface InferenceProviderConfig {
  url: string;
  getApiKey: () => string;
  getModelName: () => string;
}

export interface CompletionConfig {
  model: string;
  maxTokens: number;
  openrouterApiKey: string;
}

export interface Choice {
  index: number;
  finish_reason: string | null;
  delta: { role?: Role; content?: string };
}

export interface ChatStreamChunk {
  id: string;
  model: string;
  object: string;
  created: number;
  choices: Choice[];
}
