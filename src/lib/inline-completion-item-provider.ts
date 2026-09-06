import * as vscode from "vscode";

import { CompletionCache } from "@/cache/completion-cache";
import { ApiClient } from "@/lib/api-client";
import { ContextGatherer } from "@/lib/context-gatherer";
import { DeduplicationService } from "@/services/deduplication-service";
import { IntentTrackerService } from "@/services/intent-tracker-service";
import { PromptBuilder } from "@/services/prompt-builder";
import type { ChatMessage, PendingCompletion, ReplacementEdit } from "@/types";
import { DeletionDecoration } from "@/utils/deletion-decoration";

export class InlineCompletionItemProvider implements vscode.InlineCompletionItemProvider {
  private pendingCompletion: PendingCompletion | null = null;
  private lastCompletionText: string = "";
  private lastCompletionUri: string | null = null;
  private lastCompletionPosition: vscode.Position | null = null;

  constructor(
    private readonly outputChannel: vscode.OutputChannel,
    private readonly apiClient: ApiClient,
    private readonly intentTracker: IntentTrackerService,
    private readonly completionCache: CompletionCache,
    private readonly contextGatherer: ContextGatherer,
    private readonly promptBuilder: PromptBuilder,
    private readonly deduplicationService: DeduplicationService,
    private readonly deletionDecoration: DeletionDecoration
  ) {}

  getPendingEdit(): ReplacementEdit | null {
    return this.pendingCompletion?.edit ?? null;
  }

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

    const completionContext = await this.contextGatherer.gatherContext(document, position);
    const messages = this.promptBuilder.buildPrompt(completionContext);

    this.logger(`Prefix: ${JSON.stringify(completionContext)}`);

    if (token.isCancellationRequested) {
      this.logger("Request cancelled");
      return null;
    }

    let result = "";
    try {
      result = await this.callCompletionApi(messages, token);
    } catch (error) {
      this.logger(`Api error: ${error}`);
    }

    result = this.cleanCompletionText(result);
    const dedupResult = this.deduplicationService.check(document, position, result);

    if (!dedupResult.proceed) {
      this.logger(`Deduplication rejected: ${dedupResult.reasonText ?? "no reason provider"}`);
      return null;
    }

    const edit = this.computeMinimalReplacement(
      document,
      completionContext.replacementRegion.range.start,
      completionContext.replacementRegion.range.end,
      result
    );

    if (!edit || edit.insertText.length === 0) {
      this.logger(`No changes detected in the completion`);
      return null;
    }

    this.logger(`Replacement Edit ${JSON.stringify(edit)}`);

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

    return this.activateCompletion(cachedEdit, document);
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
    this.lastCompletionPosition = edit.deleteRange.start;
    this.lastCompletionUri = document.uri.toString();

    this.pendingCompletion = {
      documentUri: document.uri.toString(),
      edit
    };

    if (edit.deletedText.length > 0) {
      const editor = vscode.window.activeTextEditor;
      if (editor && editor.document.uri.toString() === document.uri.toString()) {
        const decorationRange = edit.actualDeleteRange ?? edit.deleteRange;
        this.deletionDecoration.showDeletion(editor, decorationRange);
      }
    }

    return this.createInlineCompletionList(edit.insertText, edit.deleteRange);
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

  private cleanCompletionText(text: string): string {
    let cleaned = text.replace(/^```\w*\n?/, "").replace(/\n?```$/, "");
    const explanationPattern = /\n\n(?:\/\/|\/\*|#|Note:|Explanation:)[\s\S]*$/;
    cleaned = cleaned.replace(explanationPattern, "");
    return cleaned.trimEnd();
  }

  private handlePendingCompletionCheck(
    document: vscode.TextDocument,
    position: vscode.Position
  ): vscode.InlineCompletionList | null | undefined {
    if (!this.pendingCompletion) return undefined;

    const pendingDocumentUri = this.pendingCompletion.documentUri;
    const pendingPosition = this.pendingCompletion.edit.deleteRange.start;

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

  clearPendingCompletion() {
    this.pendingCompletion = null;
    this.deletionDecoration.clearDecorations();
  }

  private computeMinimalReplacement(
    document: vscode.TextDocument,
    regionStart: vscode.Position,
    regionEnd: vscode.Position,
    newText: string
  ): ReplacementEdit | null {
    const oldText = document.getText(new vscode.Range(regionStart, regionEnd));
    if (oldText === newText) {
      return null;
    }

    const minLength = Math.min(oldText.length, newText.length);

    let prefixLength = 0;
    while (prefixLength < minLength && oldText[prefixLength] === newText[prefixLength]) {
      prefixLength++;
    }

    let suffixLength = 0;
    const maxSuffixLength = minLength - prefixLength;
    while (
      suffixLength < maxSuffixLength &&
      oldText[oldText.length - 1 - suffixLength] === newText[newText.length - 1 - suffixLength]
    ) {
      suffixLength++;
    }

    const oldDiffEnd = oldText.length - suffixLength;
    const newDiffEnd = newText.length - suffixLength;
    const deletedText = oldText.slice(prefixLength, oldDiffEnd);

    const regionStartOffset = document.offsetAt(regionStart);
    const actualDeleteStart = document.positionAt(regionStartOffset + prefixLength);
    const actualDeleteEnd = document.positionAt(regionStartOffset + oldDiffEnd);

    return {
      deleteRange: new vscode.Range(regionStart, actualDeleteEnd),
      insertText: newText.slice(0, newDiffEnd),
      deletedText,
      actualDeleteRange: deletedText
        ? new vscode.Range(actualDeleteStart, actualDeleteEnd)
        : undefined
    };
  }

  private logger(message: string) {
    this.outputChannel.appendLine(`[Provider] ${message}`);
  }

  dispose(): void {
    this.completionCache.dispose();
    this.apiClient.dispose();
    this.intentTracker.dispose();
    this.contextGatherer.dispose();
    this.deletionDecoration.dispose();
  }
}
