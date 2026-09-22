import type { CompletionConfig } from "@/types";

export const DEFAULT_INFERENCE: CompletionConfig = {
  completionCacheMaxEntries: 100,
  completionCacheTtlMs: 30_000,
  fireworksApiKey: "",
  groqApiKey: "",
  lspCacheMaxEntries: 100,
  maxTokens: 500,
  model: "qwen/qwen3.8-27b",
  openrouterApiKey: "",
};
