import { getConfigService } from "@/services/config-service";
import type { CompletionConfig, InferenceProvider, InferenceProviderConfig } from "@/types";

export const INFERENCE_CONFIG: Record<InferenceProvider, InferenceProviderConfig> = {
  openrouter: {
    getModelName: () => getConfigService().model,
    url: "https://openrouter.ai/api/v1/chat/completions",
    getApiKey: () => getConfigService().openRouterApiKey
  }
};

export const DEFAULT_INFERENCE: CompletionConfig = {
  maxTokens: 1000,
  openrouterApiKey: "",
  completionCacheMaxEntries: 100,
  completionCacheTtlMs: 30000,
  model: "poolside/laguna-s-2.1:free"
};
