import * as vscode from "vscode";

import { CompletionCache } from "@/cache/completion-cache";
import { ApiClient } from "@/lib/api-client";
import { ContextGatherer } from "@/lib/context-gatherer";
import { InlineCompletionItemProvider } from "@/lib/inline-completion-item-provider";
import { LocaleDependencyResolver } from "@/lib/local-dependency-resolver";
import { PrefixStage } from "@/lib/prefix-stage";
import { ReplacementRegionStage } from "@/lib/replacement-region-stage";
import { SuffixStage } from "@/lib/suffix-stage";
import { AstService } from "@/services/ast-service";
import { CrossFileService } from "@/services/cross-file-service";
import { DeduplicationService } from "@/services/deduplication-service";
import { IntentTrackerService } from "@/services/intent-tracker-service";
import { LSPService } from "@/services/lsp-service";
import { PromptBuilder } from "@/services/prompt-builder";
import { ReplacementEdit } from "@/types";
import { DeletionDecoration } from "@/utils/deletion-decoration";
import { ReferenceExtractor } from "@/utils/reference-extractor";
import { SignatureProvider } from "@/utils/signature-provider";
import { SymbolIndex } from "@/utils/symbol-index";

export function activate(context: vscode.ExtensionContext) {
  const outputChannel = vscode.window.createOutputChannel("Tab completion");
  outputChannel.appendLine("Extension activated");

  const completionCache = new CompletionCache();
  const apiClient = new ApiClient(outputChannel);
  const intentTracker = new IntentTrackerService();
  const lspService = new LSPService();
  const astService = new AstService(context.extensionPath);

  void astService.initialize().then(async () => {
    outputChannel.appendLine("AST Service initialized");
    const activeEditor = vscode.window.activeTextEditor;

    if (activeEditor) {
      await astService.ensureLanguage(activeEditor.document.languageId);
    }

    vscode.window.onDidChangeActiveTextEditor(async (editor) => {
      if (editor && astService.isReady) {
        await astService.ensureLanguage(editor.document.languageId);
      }
    });
  });

  const localDependencyResolver = new LocaleDependencyResolver(lspService);
  const prefixStage = new PrefixStage(lspService, outputChannel, localDependencyResolver);
  const replacementRegionStage = new ReplacementRegionStage(astService);
  const suffixStage = new SuffixStage();
  const deduplicationService = new DeduplicationService();
  const promptBuilder = new PromptBuilder();
  const symbolIndex = new SymbolIndex(lspService);
  const referenceExtractor = new ReferenceExtractor(astService);
  const signatureProvider = new SignatureProvider(astService);
  const crossFileService = new CrossFileService(
    lspService,
    symbolIndex,
    astService,
    referenceExtractor,
    signatureProvider
  );
  const contextGatherer = new ContextGatherer(
    intentTracker,
    prefixStage,
    replacementRegionStage,
    suffixStage,
    crossFileService
  );
  const deletionDecoration = new DeletionDecoration();

  const provider = new InlineCompletionItemProvider(
    outputChannel,
    apiClient,
    intentTracker,
    completionCache,
    contextGatherer,
    promptBuilder,
    deduplicationService,
    deletionDecoration
  );

  const disposable = vscode.languages.registerInlineCompletionItemProvider(
    { pattern: "**" },
    provider
  );

  const acceptCompletionCommand = vscode.commands.registerCommand(
    "supermaven.acceptCompletion",
    async () => {
      outputChannel?.appendLine("[Extension] Accept completion command executed");

      const editor = vscode.window.activeTextEditor;
      if (!editor || !provider) {
        outputChannel?.appendLine("[Extension] No editor or provider");
        return;
      }

      const pendingEdit = provider.getPendingEdit();
      if (!pendingEdit) {
        outputChannel?.appendLine("[Extension] No pending edit, falling back to normal tab");
        await vscode.commands.executeCommand("tab");
        return;
      }

      outputChannel?.appendLine(
        `[Extension] Applying edit: delete ${pendingEdit.deleteRange.start.line}:${pendingEdit.deleteRange.start.character}-${pendingEdit.deleteRange.end.line}:${pendingEdit.deleteRange.end.character}, insert "${pendingEdit.insertText.slice(0, 30)}..."`
      );

      const success = await editor.edit(
        (editBuilder) => {
          editBuilder.replace(pendingEdit.deleteRange, pendingEdit.insertText);
        },
        {
          undoStopBefore: true,
          undoStopAfter: true
        }
      );

      if (success) {
        outputChannel?.appendLine("[Extension] Edit applied successfully");

        const insertLines = pendingEdit.insertText.split("\n");
        const insertEnd =
          insertLines.length === 1
            ? new vscode.Position(
                pendingEdit.deleteRange.start.line,
                pendingEdit.deleteRange.start.character + pendingEdit.insertText.length
              )
            : new vscode.Position(
                pendingEdit.deleteRange.start.line + insertLines.length - 1,
                insertLines[insertLines.length - 1]!.length
              );
        editor.selection = new vscode.Selection(insertEnd, insertEnd);

        intentTracker?.recordAcceptedSuggestion(
          editor.document.uri.fsPath,
          pendingEdit.deleteRange.start.line + 1,
          pendingEdit.insertText
        );
      } else {
        outputChannel?.appendLine("[Extension] Edit failed to apply");
      }

      provider.clearPendingCompletion();
    }
  );

  const rejectCompletionCommand = vscode.commands.registerCommand(
    "supermaven.rejectCompletion",
    async () => {
      outputChannel?.appendLine("[Extension] Reject completion command executed");

      const editor = vscode.window.activeTextEditor;
      if (!editor || !provider) {
        outputChannel?.appendLine("[Extension] No editor or provider");
        return;
      }

      const pendingEdit: ReplacementEdit | null = provider?.getPendingEdit();
      if (!pendingEdit) {
        outputChannel?.appendLine("[Extension] No pending edit, falling back to normal tab");
        return;
      }

      intentTracker?.recordRejectedSuggestion(
        editor.document.uri.fsPath,
        pendingEdit.deleteRange.start.line + 1,
        pendingEdit.insertText
      );

      provider.clearPendingCompletion();
    }
  );

  context.subscriptions.push(
    disposable,
    outputChannel,
    acceptCompletionCommand,
    rejectCompletionCommand
  );
}

export function deactivate() {}
