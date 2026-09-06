import * as vscode from "vscode";
import { INFERENCE_CONFIG } from "@/constants/inference-config";
import { getConfigService } from "@/services/config-service";
import { ChatMessage, ChatStreamChunk, InferenceProvider } from "@/types";

export class ApiClient implements vscode.Disposable {
  private pendingRequest: AbortController | null = null;

  constructor(private readonly outputChannel: vscode.OutputChannel) { }

  cancelRequest() {
    if (this.pendingRequest) {
      this.pendingRequest.abort();
      this.pendingRequest = null;
    }
  }

  getActiveProvider(): InferenceProvider | null {
    const config = getConfigService();
    if (config.openRouterApiKey) return 'openrouter'
    if (config.groqApiKey) return 'groq';
    if (config.fireworksApiKey) return 'fireworks';
    return null;
  }

  async complete(messages: ChatMessage[]): Promise<AsyncGenerator<string, void, unknown>> {
    const inferenceProvider = this.getActiveProvider();

    if (!inferenceProvider) {
      throw new Error(`No inference provider configured. please provide an valid api key`);
    }

    this.cancelRequest();
    this.pendingRequest = new AbortController();

    const config = getConfigService();

    const maxTokens = config.maxTokens;
    const inferenceConfig = INFERENCE_CONFIG[inferenceProvider];

    const model = inferenceConfig.getModelName();

    const body: Record<string, unknown> = {
      model,
      messages,
      stream: true,
      temperature: 0.1,
      max_tokens: maxTokens
    };

    if (inferenceProvider === 'groq') {
      body['reasoning_effort'] = 'none';
    }

    this.logger(`[${inferenceProvider}] Request: model=${model}, max_tokens=${maxTokens}`);

    return this.streamRequest(inferenceConfig.url, body, inferenceConfig.getApiKey(), this.pendingRequest.signal);
  }

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
      body: JSON.stringify(body),
      signal
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
        // oxlint-disable-next-line no-await-in-loop
        const { done, value } = await reader.read();

        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");

        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6);

            if (data === "[DONE]") return;

            try {
              const chunk = JSON.parse(data) as ChatStreamChunk;

              if (chunk.choices && chunk.choices.length > 0) {
                const content = chunk.choices[0]?.delta.content;
                if (content) {
                  yield content;
                }
              }
            } catch (error) {
              this.logger(`LLM response parse error:${error}`);
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
    this.cancelRequest();
  }
}
