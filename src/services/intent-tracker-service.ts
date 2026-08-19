import * as vscode from "vscode";

export class IntentTrackerService implements vscode.Disposable {
  private readonly disposables: vscode.Disposable[] = [];

  constructor() {
    this.registerListeners();
  }

  private registerListeners() {
    this.disposables.push(
      vscode.workspace.onDidChangeTextDocument((event) => {
        this.handleDocumentChange(event);
      })
    );

    this.disposables.push(
      vscode.window.onDidChangeActiveTextEditor((editor) => {
        this.handleActiveEditorChange(editor);
      })
    );
  }

  private handleDocumentChange(event: vscode.TextDocumentChangeEvent) {}

  private handleActiveEditorChange(editor: vscode.TextEditor | undefined) {}

  dispose() {
    throw new Error("Method not implemented.");
  }
}
