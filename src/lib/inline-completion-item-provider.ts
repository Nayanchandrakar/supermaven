import * as vscode from "vscode";

export class InlineCompletionItemProvider implements vscode.InlineCompletionItemProvider {
  constructor(private readonly outputChannel: vscode.OutputChannel) {}

  async provideInlineCompletionItems(
    document: vscode.TextDocument,
    position: vscode.Position,
    _context: vscode.InlineCompletionContext,
    _token: vscode.CancellationToken
  ): Promise<vscode.InlineCompletionList | null> {
    const prefix = document.getText(new vscode.Range(new vscode.Position(0, 0), position));

    this.logger(`${document.fileName} ${position.line} ${position.character} ${prefix}`);

    const newItem = new vscode.InlineCompletionItem("console.log()");

    return { items: [newItem] };
  }

  private logger(message: string) {
    this.outputChannel.appendLine(`[Provider] ${message}`);
  }
}
