import { getConfigService } from "@/services/config-service";
import type { CompletionConfig, InferenceProvider, InferenceProviderConfig } from "@/types";

export const INFERENCE_CONFIG: Record<InferenceProvider, InferenceProviderConfig> = {
  openrouter: {
    getModelName: () => getConfigService().model,
    url: "https://openrouter.ai/api/v1/chat/completions",
    getApiKey: () => getConfigService().openRouterApiKey
  },
  groq: {
    getModelName: () => getConfigService().model,
    url: "https://api.groq.com/v1/chat/completions",
    getApiKey: () => getConfigService().groqApiKey
  },
  fireworks: {
    getModelName: () => getConfigService().model,
    url: "https://api.fireworks.ai/v2/chat/completions",
    getApiKey: () => getConfigService().fireworksApiKey
  },
};

export const DEFAULT_INFERENCE: CompletionConfig = {
  maxTokens: 1000,
  openrouterApiKey: "",
  groqApiKey: "",
  fireworksApiKey: "",
  completionCacheMaxEntries: 100,
  completionCacheTtlMs: 30000,
  model: "stealth/ox-alpha",
  lspCacheMaxEntries: 100
};
