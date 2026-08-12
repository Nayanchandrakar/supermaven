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
        "Type '// inline-demo', 'const greeting =' or 'function demo' at the end of a line to see an inline completion."
      );
    }
  );

  const inlineCompletionProvider = vscode.languages.registerInlineCompletionItemProvider(
    [{ scheme: "file" }, { scheme: "untitled" }],
    new DemoInlineCompletionProvider()
  );

  context.subscriptions.push(disposable, showInlineCompletionDemo, inlineCompletionProvider);
}

export function deactivate() {}
