import * as vscode from "vscode";
import { DEFAULT_INFERENCE } from "@/constants/inference-config";
import { PACKAGE_NAME } from "@/constants/package";
import { CompletionConfig } from "@/types";

export class ConfigurationService implements vscode.Disposable {
  private config: CompletionConfig;
  private readonly disposables: vscode.Disposable[] = [];
  private static instance: ConfigurationService | null = null;
  private readonly changeListeners: Set<(config: CompletionConfig) => void> = new Set();

  private constructor() {
    this.config = this.loadConfig();
    this.registerConfigChangeListener();
  }

  static init() {
    if (!ConfigurationService.instance) {
      ConfigurationService.instance = new ConfigurationService();
    }
    return ConfigurationService.instance;
  }

  private loadConfig() {
    const config = vscode.workspace.getConfiguration(PACKAGE_NAME);
    return {
      model: config.get<string>("model", DEFAULT_INFERENCE.model),
      maxTokens: config.get<number>("maxTokens", DEFAULT_INFERENCE.maxTokens),
      completionCacheTtlMs: config.get<number>(
        "completionCacheTtlMs",
        DEFAULT_INFERENCE.completionCacheTtlMs
      ),
      completionCacheMaxEntries: config.get<number>(
        "openrouterApiKey",
        DEFAULT_INFERENCE.completionCacheMaxEntries
      ),
      openrouterApiKey: config.get<string>("openrouterApiKey", DEFAULT_INFERENCE.openrouterApiKey),
      groqApiKey: config.get<string>("groqApiKey", DEFAULT_INFERENCE.groqApiKey),
      fireworksApiKey: config.get<string>("fireworksApiKey", DEFAULT_INFERENCE.fireworksApiKey),
      lspCacheMaxEntries: config.get<number>(
        "lspCacheMaxEntries",
        DEFAULT_INFERENCE.lspCacheMaxEntries
      )
    };
  }

  private registerConfigChangeListener() {
    this.disposables.push(
      vscode.workspace.onDidChangeConfiguration((e) => {
        if (e.affectsConfiguration(PACKAGE_NAME)) {
          this.config = this.loadConfig();
          this.notifyListeners();
        }
      })
    );
  }

  private notifyListeners() {
    for (const listener of this.changeListeners) {
      listener(this.config);
    }
  }

  get model(): string {
    return this.config.model;
  }

  get openRouterApiKey(): string {
    return this.config.openrouterApiKey;
  }

  get groqApiKey(): string {
    return this.config.groqApiKey;
  }

  get fireworksApiKey(): string {
    return this.config.fireworksApiKey;
  }

  get maxTokens(): number {
    return this.config.maxTokens;
  }

  get completionCacheTtlMs(): number {
    return this.config.completionCacheTtlMs;
  }

  get completionCacheMaxEntries(): number {
    return this.config.completionCacheMaxEntries;
  }

  get lspCacheMaxEntries(): number {
    return this.config.lspCacheMaxEntries;
  }

  onConfigChange(listener: (config: CompletionConfig) => void): vscode.Disposable {
    this.changeListeners.add(listener);
    return {
      dispose: () => this.changeListeners.delete(listener)
    };
  }

  dispose() {
    this.disposables.forEach((d) => d.dispose());
    this.changeListeners.clear();
  }
}

export function getConfigService(): ConfigurationService {
  return ConfigurationService.init();
}
