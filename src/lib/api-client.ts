import * as vscode from "vscode";
import { ChatStreamChunk } from "@/types";

export class ApiClient implements vscode.Disposable {
  constructor(private readonly outputChannel: vscode.OutputChannel) {}

  private async *streamRequest(
    endpoint: string,
    body: Record<string, unknown>,
    apiKey: string,
    signal: AbortSignal
  ): AsyncGenerator<string, void, unknown> {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-type": "application/json"
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Api error ${response.status}: ${errorText}`);
    }

    if (!response.body) {
      throw new Error("No response body");
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    try {
      while (1) {
        const { done, value } = await reader.read();

        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");

        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6);

            if (data === "[DONE]") {
              return;
            }

            try {
              const chunk = JSON.parse(data) as ChatStreamChunk;

              if (chunk.choices && chunk.choices.length > 0) {
                const content = chunk.choices[0]?.delta.content;
                if (content) {
                  yield content;
                }
              }
            } catch (error) {
              this.logger(`Parse error:${error}`);
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  private logger(message: string) {
    this.outputChannel.appendLine(`[ApiClient] ${message}`);
  }

  dispose() {
    throw new Error("Method not implemented.");
  }
}
