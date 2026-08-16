import * as vscode from "vscode";
import { InlineCompletionItemProvider } from "@/lib/inline-completion-item-provider";

export function activate(context: vscode.ExtensionContext) {
  const outputChannel = vscode.window.createOutputChannel("Tab completion");
  outputChannel.appendLine("Extension activated");

  const provider = new InlineCompletionItemProvider(outputChannel);

  const disposable = vscode.languages.registerInlineCompletionItemProvider(
    { pattern: "**" },
    provider
  );

  context.subscriptions.push(disposable);
}

export function deactivate() {}
