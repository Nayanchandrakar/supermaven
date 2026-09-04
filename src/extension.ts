import * as vscode from "vscode";

import { CompletionCache } from "@/cache/completion-cache";
import { ApiClient } from "@/lib/api-client";
import { ContextGatherer } from "@/lib/context-gatherer";
import { InlineCompletionItemProvider } from "@/lib/inline-completion-item-provider";
import { PrefixStage } from "@/lib/prefix-stage";
import { IntentTrackerService } from "@/services/intent-tracker-service";
import { LocaleDependencyResolver } from "@/lib/local-dependency-resolver";
import { LSPService } from "@/services/lsp-service";
import { AstService } from "@/services/ast-service";

export function activate(context: vscode.ExtensionContext) {
  const outputChannel = vscode.window.createOutputChannel("Tab completion");
  outputChannel.appendLine("Extension activated");

  const completionCache = new CompletionCache();
  const apiClient = new ApiClient(outputChannel);
  const intentTracker = new IntentTrackerService();
  const lspService = new LSPService();
  const astService = new AstService(context.extensionPath)

  void astService.initialize().then(async () => {
    outputChannel.appendLine("AST Service initialized")
    const activeEditor = vscode.window.activeTextEditor;

    if (activeEditor) {
      await astService.ensureLanguage(activeEditor.document.languageId)
    }

    vscode.window.onDidChangeActiveTextEditor(async (editor) => {
      if (editor && astService.isReady) {
        await astService.ensureLanguage(editor.document.languageId)
      }
    })
  })

  const localDependencyResolver = new LocaleDependencyResolver(lspService);
  const prefixStage = new PrefixStage(lspService, outputChannel, localDependencyResolver);
  const contextGatherer = new ContextGatherer(intentTracker, prefixStage, lspService);

  const provider = new InlineCompletionItemProvider(
    outputChannel,
    apiClient,
    intentTracker,
    completionCache,
    contextGatherer
  );

  const disposable = vscode.languages.registerInlineCompletionItemProvider(
    { pattern: "**" },
    provider
  );

  context.subscriptions.push(disposable, outputChannel);
}

export function deactivate() { }
