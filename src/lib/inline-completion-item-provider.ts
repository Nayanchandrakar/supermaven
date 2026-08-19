import * as vscode from "vscode";
import { ApiClient } from "@/lib/api-client";
import { ChatMessage } from "@/types";

export class InlineCompletionItemProvider implements vscode.InlineCompletionItemProvider {
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
    const prefix = document.getText(new vscode.Range(new vscode.Position(0, 0), position));

    this.logger(`${document.fileName} ${position.line} ${position.character} ${prefix}`);

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

    const newItem = new vscode.InlineCompletionItem(result);
    return { items: [newItem] };
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

  private logger(message: string) {
    this.outputChannel.appendLine(`[Provider] ${message}`);
  }
}
