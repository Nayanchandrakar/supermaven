import * as vscode from "vscode";
import { ApiClient } from "@/lib/api-client";
import { ChatMessage, PendingCompletion } from "@/types";

export class InlineCompletionItemProvider implements vscode.InlineCompletionItemProvider {

  private pendingCompletion: PendingCompletion | null = null;

  constructor(
    private readonly outputChannel: vscode.OutputChannel,
    private readonly apiClient: ApiClient
  ) { }

  async provideInlineCompletionItems(
    document: vscode.TextDocument,
    position: vscode.Position,
    _context: vscode.InlineCompletionContext,
    token: vscode.CancellationToken
  ): Promise<vscode.InlineCompletionList | null> {

    const pendingCompletionResult = this.handlePendingCompletionCheck(document, position)

    // oxlint-disable-next-line no-constant-binary-expression
    if (!pendingCompletionResult !== undefined) {
      return pendingCompletionResult!
    }

    const prefix = document.getText(new vscode.Range(new vscode.Position(0, 0), position));

    this.logger(`${document.fileName} ${document.uri} ${position.line} ${position.character} ${prefix}`);

    let result = "";
    try {
      result = await this.callCompletionApi(
        [
          {
            role: "system",
            content:
              "You are an AI code assistant. Provide concise and context-aware code completions. Only respond with the most likely next lines of code, no explanations."
          },
          {
            role: "user",
            content: prefix
          }
        ],
        token
      );
    } catch (error) {
      this.logger(`Api error: ${error}`);
    }

    this.pendingCompletion = {
      documentUri: document.uri.toString(),
      edit: {
        insertText: result,
        startPosition: position
      }
    }

    return this.createInlineCompletionItem(result)
  }


  private createInlineCompletionItem(result: string, range?: vscode.Range): vscode.InlineCompletionList {
    return { items: [new vscode.InlineCompletionItem(result, range)] }
  }

  private async callCompletionApi(messages: ChatMessage[], token: vscode.CancellationToken) {
    const generator = await this.apiClient.complete(messages);

    let result: string = "";

    for await (const chunk of generator) {
      if (token.isCancellationRequested) {
        this.apiClient.cancelRequest();
        break;
      }

      result += chunk;
    }

    return result;
  }


  private handlePendingCompletionCheck(document: vscode.TextDocument, position: vscode.Position): vscode.InlineCompletionList |
    null | undefined {

    if (!this.pendingCompletion) return undefined

    const pendingDocumentUri = this.pendingCompletion.documentUri
    const pendingPosition = this.pendingCompletion.edit.startPosition

    if (pendingDocumentUri !== document.uri.toString() || pendingPosition.line !== position.line || pendingPosition.character !== position.character) {
      this.clearPendingCompletion()
      return undefined;
    }

    return this.createInlineCompletionItem(this.pendingCompletion.edit.insertText)
  }

  private clearPendingCompletion() {
    this.pendingCompletion = null;
  }

  private logger(message: string) {
    this.outputChannel.appendLine(`[Provider] ${message}`);
  }
}
