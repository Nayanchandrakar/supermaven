import * as vscode from "vscode";
import { BoundedCache } from "@/cache/bounded-cache";
import { ReplacementEdit } from "@/types";
import { getConfigService } from "@/services/config-service";

export class CompletionCache implements vscode.Disposable {
  private cache: BoundedCache<ReplacementEdit>;
  private readonly disposables: vscode.Disposable[] = []

  private ttlMs: number;
  private currentMaxEntries: number;

  constructor() {
    const configService = getConfigService();
    this.currentMaxEntries = configService.completionCacheMaxEntries
    this.ttlMs = configService.completionCacheTtlMs

    this.cache = new BoundedCache<ReplacementEdit>(this.currentMaxEntries)
    this.disposables.push(configService.onConfigChange((config) => {
      if (config.completionCacheMaxEntries !== this.currentMaxEntries) {
        this.currentMaxEntries = config.completionCacheMaxEntries
        this.cache = new BoundedCache<ReplacementEdit>(this.currentMaxEntries)
      }
    }))
  }
  dispose() {
    throw new Error("dispose function is not being implemented");
  }
}
