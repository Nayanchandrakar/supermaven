import * as vscode from "vscode";

import { DEFAULT_INFERENCE } from "@/constants/inference-defaults";
import { PACKAGE_NAME } from "@/constants/package";
import type { CompletionConfig } from "@/types";

export class ConfigurationService implements vscode.Disposable {
  private config: CompletionConfig;
  private readonly disposables: vscode.Disposable[] = [];
  private static instance: ConfigurationService | null = null;
  private readonly changeListeners = new Set<
    (config: CompletionConfig) => void
  >();

  private constructor() {
    this.config = ConfigurationService.loadConfig();
    this.registerConfigChangeListener();
  }

  static init() {
    if (!ConfigurationService.instance) {
      ConfigurationService.instance = new ConfigurationService();
    }
    return ConfigurationService.instance;
  }

  private static loadConfig(): CompletionConfig {
    const config = vscode.workspace.getConfiguration(PACKAGE_NAME);
    return {
      completionCacheMaxEntries: config.get<number>(
        "completionCacheMaxEntries",
        DEFAULT_INFERENCE.completionCacheMaxEntries
      ),
      completionCacheTtlMs: config.get<number>(
        "completionCacheTtlMs",
        DEFAULT_INFERENCE.completionCacheTtlMs
      ),
      fireworksApiKey: config.get<string>(
        "fireworksApiKey",
        DEFAULT_INFERENCE.fireworksApiKey
      ),
      groqApiKey: config.get<string>(
        "groqApiKey",
        DEFAULT_INFERENCE.groqApiKey
      ),
      lspCacheMaxEntries: config.get<number>(
        "lspCacheMaxEntries",
        DEFAULT_INFERENCE.lspCacheMaxEntries
      ),
      maxTokens: config.get<number>("maxTokens", DEFAULT_INFERENCE.maxTokens),
      model: config.get<string>("model", DEFAULT_INFERENCE.model),
      openrouterApiKey: config.get<string>(
        "openrouterApiKey",
        DEFAULT_INFERENCE.openrouterApiKey
      ),
    };
  }

  private registerConfigChangeListener() {
    this.disposables.push(
      vscode.workspace.onDidChangeConfiguration((e) => {
        if (e.affectsConfiguration(PACKAGE_NAME)) {
          this.config = ConfigurationService.loadConfig();
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

  onConfigChange(
    listener: (config: CompletionConfig) => void
  ): vscode.Disposable {
    this.changeListeners.add(listener);
    return {
      dispose: () => this.changeListeners.delete(listener),
    };
  }

  dispose() {
    for (const disposable of this.disposables) {
      disposable.dispose();
    }
    this.changeListeners.clear();
  }
}

export const getConfigService = (): ConfigurationService =>
  ConfigurationService.init();
