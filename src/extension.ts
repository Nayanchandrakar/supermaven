import * as vscode from "vscode";

import { CompletionCache } from "@/cache/completion-cache";
import { ApiClient } from "@/lib/api-client";
import { InlineCompletionItemProvider } from "@/lib/inline-completion-item-provider";
import { IntentTrackerService } from "@/services/intent-tracker-service";

export function activate(context: vscode.ExtensionContext) {
  const outputChannel = vscode.window.createOutputChannel("Tab completion");
  outputChannel.appendLine("Extension activated");

  const apiClient = new ApiClient(outputChannel);
  const completionCache = new CompletionCache();
  const intentTracker = new IntentTrackerService();
  const provider = new InlineCompletionItemProvider(
    outputChannel,
    apiClient,
    intentTracker,
    completionCache
  );

  const disposable = vscode.languages.registerInlineCompletionItemProvider(
    { pattern: "**" },
    provider
  );

  context.subscriptions.push(disposable, outputChannel);
}

export function deactivate() {}
