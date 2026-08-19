import * as vscode from "vscode";

import { ApiClient } from "@/lib/api-client";
import { InlineCompletionItemProvider } from "@/lib/inline-completion-item-provider";

export function activate(context: vscode.ExtensionContext) {
  const outputChannel = vscode.window.createOutputChannel("Tab completion");
  outputChannel.appendLine("Extension activated");

  const apiClient = new ApiClient(outputChannel);
  const provider = new InlineCompletionItemProvider(outputChannel, apiClient);

  const disposable = vscode.languages.registerInlineCompletionItemProvider(
    { pattern: "**" },
    provider
  );

  context.subscriptions.push(disposable, outputChannel);
}

export function deactivate() {}
