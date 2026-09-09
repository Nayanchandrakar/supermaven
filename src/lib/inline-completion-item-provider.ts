import * as vscode from "vscode";

import type { CompletionCache } from "@/cache/completion-cache";
import type { ApiClient } from "@/lib/api-client";
import type { ContextGatherer } from "@/lib/context-gatherer";
import type { DeduplicationService } from "@/services/deduplication-service";
import type { IntentTrackerService } from "@/services/intent-tracker-service";
import { PromptBuilder } from "@/services/prompt-builder";
import type { ChatMessage, PendingCompletion, ReplacementEdit } from "@/types";
import type { DeletionDecoration } from "@/utils/deletion-decoration";

export class InlineCompletionItemProvider
  implements vscode.InlineCompletionItemProvider
{
  private pendingCompletion: PendingCompletion | null = null;
  private lastCompletionText = "";
  private lastCompletionUri: string | null = null;
  private lastCompletionPosition: vscode.Position | null = null;
  private readonly outputChannel: vscode.OutputChannel;
  private readonly apiClient: ApiClient;
  private readonly intentTracker: IntentTrackerService;
  private readonly completionCache: CompletionCache;
  private readonly contextGatherer: ContextGatherer;
  private readonly deduplicationService: DeduplicationService;
  private readonly deletionDecoration: DeletionDecoration;

  constructor(
    outputChannel: vscode.OutputChannel,
    apiClient: ApiClient,
    intentTracker: IntentTrackerService,
    completionCache: CompletionCache,
    contextGatherer: ContextGatherer,
    deduplicationService: DeduplicationService,
    deletionDecoration: DeletionDecoration
  ) {
    this.outputChannel = outputChannel;
    this.apiClient = apiClient;
    this.intentTracker = intentTracker;
    this.completionCache = completionCache;
    this.contextGatherer = contextGatherer;
    this.deduplicationService = deduplicationService;
    this.deletionDecoration = deletionDecoration;
  }

  getPendingEdit(): ReplacementEdit | null {
    return this.pendingCompletion?.edit ?? null;
  }

  async provideInlineCompletionItems(
    document: vscode.TextDocument,
    position: vscode.Position,
    _context: vscode.InlineCompletionContext,
    token: vscode.CancellationToken
  ): Promise<vscode.InlineCompletionList | null> {
    this.logger(
      `${document.fileName} ${document.uri} ${position.line} ${position.character}`
    );

    const pendingCompletionResult = this.handlePendingCompletionCheck(
      document,
      position
    );

    if (pendingCompletionResult !== undefined) {
      return pendingCompletionResult;
    }

    const editHistoryHash = this.intentTracker.computeHash();
    const cachedResult = this.tryCachedCompletion(
      document,
      position,
      editHistoryHash
    );

    if (cachedResult) {
      return cachedResult;
    }

    const continuationResult = this.tryContinuePrediction(document, position);

    if (continuationResult !== undefined) {
      return continuationResult;
    }

    const completionContext = await this.contextGatherer.gatherContext(
      document,
      position
    );

    const messages = PromptBuilder.buildPrompt(completionContext);

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

    result = InlineCompletionItemProvider.cleanCompletionText(result);
    const dedupResult = this.deduplicationService.check(
      document,
      position,
      result
    );

    if (!dedupResult.proceed) {
      this.logger(
        `Deduplication rejected: ${dedupResult.reasonText ?? "no reason provider"}`
      );
      return null;
    }

    const edit = InlineCompletionItemProvider.computeMinimalReplacement(
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
    const cachedEdit = this.completionCache.get(
      document,
      position,
      editHistory
    );

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
    if (
      !this.lastCompletionText ||
      !this.lastCompletionPosition ||
      !this.lastCompletionUri
    ) {
      return undefined;
    }

    const charsSinceCompletion =
      position.character - this.lastCompletionPosition.character;

    if (
      position.line !== this.lastCompletionPosition.line ||
      charsSinceCompletion <= 0
    ) {
      return undefined;
    }

    const typedText = document.getText(
      new vscode.Range(this.lastCompletionPosition, position)
    );

    if (
      charsSinceCompletion >= this.lastCompletionText.length &&
      this.lastCompletionText.startsWith(typedText)
    ) {
      const remainingText = this.lastCompletionText.slice(typedText.length);

      if (remainingText) {
        this.logger(
          `Continuing prediction: typed "${typedText}", remaining "${remainingText}" `
        );
        return InlineCompletionItemProvider.createInlineCompletionList(
          remainingText,
          new vscode.Range(position, position)
        );
      }

      this.logger("User completed entire prediction");
      this.lastCompletionText = "";
      this.lastCompletionPosition = null;
      return null;
    }

    this.logger(
      `Divergence detected: expected ${this.lastCompletionText}, got ${typedText}`
    );
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
      edit,
    };

    if (edit.deletedText.length > 0) {
      const editor = vscode.window.activeTextEditor;
      if (
        editor &&
        editor.document.uri.toString() === document.uri.toString()
      ) {
        const decorationRange = edit.actualDeleteRange ?? edit.deleteRange;
        this.deletionDecoration.showDeletion(editor, decorationRange);
      }
    }

    return InlineCompletionItemProvider.createInlineCompletionList(
      edit.insertText,
      edit.deleteRange
    );
  }

  private static createInlineCompletionList(
    result: string,
    range?: vscode.Range
  ): vscode.InlineCompletionList {
    return { items: [new vscode.InlineCompletionItem(result, range)] };
  }

  private async callCompletionApi(
    messages: ChatMessage[],
    token: vscode.CancellationToken
  ) {
    const generator = await this.apiClient.complete(messages);

    let result = "";

    for await (const chunk of generator) {
      if (token.isCancellationRequested) {
        this.apiClient.cancelRequest();
        break;
      }

      result += chunk;
    }

    return result;
  }

  private static cleanCompletionText(text: string): string {
    let cleaned = text.replace(/^```\w*\n?/u, "").replace(/\n?```$/u, "");
    const explanationPattern =
      /\n\n(?:\/\/|\/\*|#|Note:|Explanation:)[\s\S]*$/u;
    cleaned = cleaned.replace(explanationPattern, "");
    return cleaned.trimEnd();
  }

  private handlePendingCompletionCheck(
    document: vscode.TextDocument,
    position: vscode.Position
  ): vscode.InlineCompletionList | null | undefined {
    if (!this.pendingCompletion) {
      return undefined;
    }

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

    return InlineCompletionItemProvider.createInlineCompletionList(
      this.pendingCompletion.edit.insertText
    );
  }

  clearPendingCompletion() {
    this.pendingCompletion = null;
    this.deletionDecoration.clearDecorations();
  }

  private static computeMinimalReplacement(
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
    while (
      prefixLength < minLength &&
      oldText[prefixLength] === newText[prefixLength]
    ) {
      prefixLength += 1;
    }

    let suffixLength = 0;
    const maxSuffixLength = minLength - prefixLength;
    while (
      suffixLength < maxSuffixLength &&
      oldText[oldText.length - 1 - suffixLength] ===
        newText[newText.length - 1 - suffixLength]
    ) {
      suffixLength += 1;
    }

    const oldDiffEnd = oldText.length - suffixLength;
    const newDiffEnd = newText.length - suffixLength;
    const deletedText = oldText.slice(prefixLength, oldDiffEnd);

    const regionStartOffset = document.offsetAt(regionStart);
    const actualDeleteStart = document.positionAt(
      regionStartOffset + prefixLength
    );
    const actualDeleteEnd = document.positionAt(regionStartOffset + oldDiffEnd);

    return {
      actualDeleteRange: deletedText
        ? new vscode.Range(actualDeleteStart, actualDeleteEnd)
        : undefined,
      deleteRange: new vscode.Range(regionStart, actualDeleteEnd),
      deletedText,
      insertText: newText.slice(0, newDiffEnd),
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
