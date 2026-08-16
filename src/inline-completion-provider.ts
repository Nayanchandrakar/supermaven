import * as vscode from "vscode";

export class InlineCompletionProvider implements vscode.InlineCompletionItemProvider {
  async provideInlineCompletionItems(
    _document: vscode.TextDocument,
    _position: vscode.Position,
    _context: vscode.InlineCompletionContext,
    _token: vscode.CancellationToken
  ): Promise<vscode.InlineCompletionList | null> {
    return { items: [new vscode.InlineCompletionItem("console.log('Hello world')")] };
  }
}
