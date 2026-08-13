import * as vscode from "vscode";
import { DemoInlineCompletionProvider } from "./inline-completion-provider.js";

export function activate(context: vscode.ExtensionContext) {
  const disposable = vscode.commands.registerCommand("cursor-tab.helloWorld", () => {
    vscode.window.showInformationMessage("Hello World from cursor-tab!");
  });

  const showInlineCompletionDemo = vscode.commands.registerCommand(
    "cursor-tab.showInlineCompletionDemo",
    () => {
      vscode.window.showInformationMessage(
        "Try tab:hello, tab:choose, demoWord, tab:filter, tab:context, tab:slow or tab:accepted. See INLINE_COMPLETION_GUIDE.md for all examples."
      );
    }
  );

  const inlineCompletionAccepted = vscode.commands.registerCommand(
    "cursor-tab.inlineCompletionAccepted",
    (trigger: unknown) => {
      vscode.window.setStatusBarMessage(`Accepted the completion for ${String(trigger)}.`, 2000);
    }
  );

  const inlineCompletionProvider = vscode.languages.registerInlineCompletionItemProvider(
    [{ scheme: "file" }, { scheme: "untitled" }],
    new DemoInlineCompletionProvider()
  );

  context.subscriptions.push(
    disposable,
    showInlineCompletionDemo,
    inlineCompletionAccepted,
    inlineCompletionProvider
  );
}

export function deactivate() {}
