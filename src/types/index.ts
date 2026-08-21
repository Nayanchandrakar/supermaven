import * as vscode from "vscode";

export type InferenceProvider = "openrouter";
export type Role = "system" | "assistant" | "user";
export type IntentType = "added" | "pasted" | "edited" | "accepted" | "rejected";

export interface InferenceProviderConfig {
  url: string;
  getApiKey: () => string;
  getModelName: () => string;
}

export interface CompletionConfig {
  model: string;
  maxTokens: number;
  openrouterApiKey: string;

  // Ceche settings
  completionCacheMaxEntries: number;
  completionCacheTtlMs: number
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

export interface ChatMessage {
  role: Role;
  content: string;
}

export interface ReplacementEdit {
  insertText: string;
  startPosition: vscode.Position;
}

export interface PendingCompletion {
  documentUri: string;
  edit: ReplacementEdit;
}

export interface PendingIntent {
  type: IntentType;
  filePath: string;
  startTime: number;
  lastActivityTime: number;
  originalContent: Map<number, string>;
  currentContent: Map<number, string>;
  affectedLines: Set<number>;
}

export interface IntentEntry {
  id: string;
  type: IntentType;
  filePath: string;
  lineRange: { start: number; end: number };
  content: string;
  timestamp: number;
  suggestionPreview?: string;
}

export interface CacheEntry<T> {
  value: T;
  accessCount: number;
  lastAccessed: number;
  groupKey: string | null;
  expiresAt: number | null;
}
