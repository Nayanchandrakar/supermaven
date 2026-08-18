export type InferenceProvider = "openrouter";

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
