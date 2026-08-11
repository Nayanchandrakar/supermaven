import * as vscode from "vscode";

export function activate(context: vscode.ExtensionContext) {
  const disposable = vscode.commands.registerCommand("cursor-tab.helloWorld", () => {
    vscode.window.showInformationMessage("testin World from cursor-tab!");
  });

  context.subscriptions.push(disposable);
}

export function deactivate() {}
