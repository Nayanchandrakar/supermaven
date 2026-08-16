import * as vscode from "vscode";
import { InlineCompletionProvider } from "@/inline-completion-provider";

export function activate(context: vscode.ExtensionContext) {
  const inlineCompletionProvider = new InlineCompletionProvider();
  const disposable = vscode.languages.registerInlineCompletionItemProvider(
    { pattern: "**" },
    inlineCompletionProvider
  );

  context.subscriptions.push(disposable);
}

export function deactivate() {}
