import { getConfigService } from "@/services/config-service";
import type { InferenceProvider, InferenceProviderConfig } from "@/types";

export const INFERENCE_CONFIG: Record<
  InferenceProvider,
  InferenceProviderConfig
> = {
  fireworks: {
    getApiKey: () => getConfigService().fireworksApiKey,
    getModelName: () => getConfigService().model,
    url: "https://api.fireworks.ai/v2/chat/completions",
  },
  groq: {
    getApiKey: () => getConfigService().groqApiKey,
    getModelName: () => getConfigService().model,
    url: "https://api.groq.com/openai/v1/chat/completions",
  },
  openrouter: {
    getApiKey: () => getConfigService().openRouterApiKey,
    getModelName: () => getConfigService().model,
    url: "https://openrouter.ai/api/v1/chat/completions",
  },
};
