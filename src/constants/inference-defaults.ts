import type { CompletionConfig } from "@/types";

export const DEFAULT_INFERENCE: CompletionConfig = {
  completionCacheMaxEntries: 100,
  completionCacheTtlMs: 30_000,
  fireworksApiKey: "",
  groqApiKey: "",
  lspCacheMaxEntries: 100,
  maxTokens: 1000,
  model: "stealth/ox-alpha",
  openrouterApiKey: "",
};
