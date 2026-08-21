import * as vscode from "vscode";

import { CompletionCache } from "@/cache/completion-cache";
import { ApiClient } from "@/lib/api-client";
import { IntentTrackerService } from "@/services/intent-tracker-service";
import type { ChatMessage, PendingCompletion, ReplacementEdit } from "@/types";

export class InlineCompletionItemProvider implements vscode.InlineCompletionItemProvider {
  private pendingCompletion: PendingCompletion | null = null;
  private lastCompletionText: string = "";
  private lastCompletionUri: string | null = null;
  private lastCompletionPosition: vscode.Position | null = null;

  constructor(
    private readonly outputChannel: vscode.OutputChannel,
    private readonly apiClient: ApiClient,
    private readonly intentTracker: IntentTrackerService,
    private readonly completionCache: CompletionCache
  ) {}

  async provideInlineCompletionItems(
    document: vscode.TextDocument,
    position: vscode.Position,
    _context: vscode.InlineCompletionContext,
    token: vscode.CancellationToken
  ): Promise<vscode.InlineCompletionList | null> {
    this.logger(`${document.fileName} ${document.uri} ${position.line} ${position.character}`);

    const pendingCompletionResult = this.handlePendingCompletionCheck(document, position);

    if (pendingCompletionResult !== undefined) {
      return pendingCompletionResult!;
    }

    const editHistoryHash = this.intentTracker.computeHash();
    const cachedResult = this.tryCachedCompletion(document, position, editHistoryHash);

    if (cachedResult) {
      return cachedResult;
    }

    const continuationResult = this.tryContinuePrediction(document, position);

    if (continuationResult !== undefined) {
      return continuationResult;
    }

    const prefix = document.getText(new vscode.Range(new vscode.Position(0, 0), position));

    if (token.isCancellationRequested) {
      this.logger("Request cancelled");
      return null;
    }

    let result = "";
    try {
      result = await this.callCompletionApi(
        [
          {
            role: "system",
            content:
              "You are an AI code assistant. Provide concise and context-aware code completions. Only respond with the most likely next lines of code, no explanations."
          },
          {
            role: "user",
            content: prefix
          }
        ],
        token
      );
    } catch (error) {
      this.logger(`Api error: ${error}`);
    }

    const edit: ReplacementEdit = { insertText: result, startPosition: position };

    this.completionCache.set(document, position, editHistoryHash, edit);

    return this.activateCompletion(edit, document);
  }

  private tryCachedCompletion(
    document: vscode.TextDocument,
    position: vscode.Position,
    editHistory: string
  ): vscode.InlineCompletionList | undefined {
    const cachedEdit = this.completionCache.get(document, position, editHistory);

    this.logger(`Cache hit ${cachedEdit?.insertText}`);

    if (!cachedEdit) {
      return undefined;
    }

    this.activateCompletion(cachedEdit, document);
  }

  private tryContinuePrediction(
    document: vscode.TextDocument,
    position: vscode.Position
  ): vscode.InlineCompletionList | undefined | null {
    if (!this.lastCompletionText || !this.lastCompletionPosition || !this.lastCompletionUri) {
      return undefined;
    }

    const charsSinceCompletion = position.character - this.lastCompletionPosition.character;

    if (position.line !== this.lastCompletionPosition.line || charsSinceCompletion <= 0) {
      return undefined;
    }

    const typedText = document.getText(new vscode.Range(this.lastCompletionPosition, position));

    if (
      charsSinceCompletion >= this.lastCompletionText.length &&
      this.lastCompletionText.startsWith(typedText)
    ) {
      const remainingText = this.lastCompletionText.slice(typedText.length);

      if (remainingText) {
        this.logger(`Continuing prediction: typed "${typedText}", remaining "${remainingText}" `);
        return this.createInlineCompletionList(remainingText, new vscode.Range(position, position));
      }

      this.logger("User completed entire prediction");
      this.lastCompletionText = "";
      this.lastCompletionPosition = null;
      return null;
    }

    this.logger(`Divergence detected: expected ${this.lastCompletionText}, got ${typedText}`);
    this.lastCompletionText = "";
    this.lastCompletionPosition = null;
    return undefined;
  }

  private activateCompletion(
    edit: ReplacementEdit,
    document: vscode.TextDocument
  ): vscode.InlineCompletionList {
    this.lastCompletionText = edit.insertText;
    this.lastCompletionPosition = edit.startPosition;
    this.lastCompletionUri = document.uri.toString();

    this.pendingCompletion = {
      documentUri: document.uri.toString(),
      edit
    };

    return this.createInlineCompletionList(edit.insertText);
  }

  private createInlineCompletionList(
    result: string,
    range?: vscode.Range
  ): vscode.InlineCompletionList {
    return { items: [new vscode.InlineCompletionItem(result, range)] };
  }

  private async callCompletionApi(messages: ChatMessage[], token: vscode.CancellationToken) {
    const generator = await this.apiClient.complete(messages);

    let result: string = "";

    for await (const chunk of generator) {
      if (token.isCancellationRequested) {
        this.apiClient.cancelRequest();
        break;
      }

      result += chunk;
    }

    return result;
  }

  private handlePendingCompletionCheck(
    document: vscode.TextDocument,
    position: vscode.Position
  ): vscode.InlineCompletionList | null | undefined {
    if (!this.pendingCompletion) return undefined;

    const pendingDocumentUri = this.pendingCompletion.documentUri;
    const pendingPosition = this.pendingCompletion.edit.startPosition;

    if (
      pendingDocumentUri !== document.uri.toString() ||
      pendingPosition.line !== position.line ||
      pendingPosition.character !== position.character
    ) {
      this.clearPendingCompletion();
      return undefined;
    }

    return this.createInlineCompletionList(this.pendingCompletion.edit.insertText);
  }

  private clearPendingCompletion() {
    this.pendingCompletion = null;
  }

  private logger(message: string) {
    this.outputChannel.appendLine(`[Provider] ${message}`);
  }
}
