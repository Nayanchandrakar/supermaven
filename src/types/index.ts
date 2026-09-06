import type * as vscode from "vscode";

export type InferenceProvider = "openrouter" | "groq" | "fireworks";
export type Role = "system" | "assistant" | "user";
export type IntentType =
  | "added"
  | "pasted"
  | "edited"
  | "accepted"
  | "rejected";

export interface InferenceProviderConfig {
  url: string;
  getApiKey: () => string;
  getModelName: () => string;
}

export interface CompletionConfig {
  model: string;
  maxTokens: number;
  openrouterApiKey: string;
  groqApiKey: string;
  fireworksApiKey: string;
  // Ceche settings
  completionCacheMaxEntries: number;
  completionCacheTtlMs: number;
  lspCacheMaxEntries: number;
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
  deleteRange: vscode.Range;
  insertText: string;
  deletedText: string;
  actualDeleteRange: vscode.Range | undefined;
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
}

export interface CacheEntry<T> {
  value: T;
  accessCount: number;
  lastAccessed: number;
  groupKey: string | null;
  expiresAt: number | null;
}

export interface EnclosingScopes {
  enclosingFunction: vscode.DocumentSymbol | null;
  enclosingClass: vscode.DocumentSymbol | null;
  symbolsByName: Map<string, vscode.DocumentSymbol[]>;
}

export interface LineSpan {
  start: number;
  end: number;
}

export interface ImportBindings {
  importedOriginalNames: Set<string>;
  importedAliasesByOriginal: Map<string, Set<string>>;
  importedLocalNames: Set<string>;
}

export interface DefinitionTarget {
  uri: vscode.Uri;
  range: vscode.Range;
}

export interface ReplacementRegion {
  text: string;
  range: vscode.Range;
}

export interface IndexedSymbol {
  name: string;
  kind: number;
  containerName?: string;
  uri: string;
  range: {
    startLine: number;
    startCharacter: number;
    endLine: number;
    endCharacter: number;
  };
  signature?: string;
}

export interface NearbyContext {
  referenceNames: Set<string>;
  declaredIdentifiers: Set<string>;
  nearbyIdentifiers: Set<string>;
}

export interface CompletionContext {
  prefix: string;
  replacementRegion: ReplacementRegion;
  suffixAfterRegion: string;
  cursorPosition: vscode.Position;
  languageId: string;
  filePath: string;
  editHistory: string;
  crossFileSymbols: IndexedSymbol[];
}

export interface FitToBudgetInput {
  systemPrompt: string;
  prefix: string;
  replaceRegion: string;
  suffix: string;
  importedSignatures: string[];
  editHistory: string;
  languageId: string;
  promptOverheadTokens?: number;
}

export interface FitToBudgetResult {
  prefix: string;
  replaceRegion: string;
  suffix: string;
  importedSignatures: string;
  editHistory: string;
}

export interface DedupOutput {
  proceed: boolean;
  completion: string;
  reasonText?: string;
}

export type RawTypeHeirarchyItems =
  | vscode.TypeHierarchyItem
  | vscode.TypeHierarchyItem[];
