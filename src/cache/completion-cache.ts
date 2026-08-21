import * as vscode from "vscode";
import { BoundedCache } from "@/cache/bounded-cache";
import { getConfigService } from "@/services/config-service";
import { ReplacementEdit } from "@/types";
import { createCacheKey } from "@/utils/create-cache-key";
import { generateHash } from "@/utils/generate-hash";

export class CompletionCache implements vscode.Disposable {
  private cache: BoundedCache<ReplacementEdit>;
  private readonly disposables: vscode.Disposable[] = [];
  private ttlMs: number;
  private currentMaxEntries: number;
  private contentHashDocument: Map<string, { version: number, hash: string }> = new Map()

  constructor() {
    const configService = getConfigService();
    this.currentMaxEntries = configService.completionCacheMaxEntries;
    this.ttlMs = configService.completionCacheTtlMs;

    this.cache = new BoundedCache<ReplacementEdit>(this.currentMaxEntries);

    this.disposables.push(
      configService.onConfigChange((config) => {
        if (config.completionCacheMaxEntries !== this.currentMaxEntries) {
          this.currentMaxEntries = config.completionCacheMaxEntries;
          this.cache = new BoundedCache<ReplacementEdit>(this.currentMaxEntries);
        }
      })
    );
  }

  private getContentHash(document: vscode.TextDocument): string {
    const uri = document.uri.toString();
    const cached = this.contentHashDocument.get(uri)

    if (cached && cached.version === document.version) {
      return cached.hash
    }

    const hash = generateHash(document.getText())
    this.contentHashDocument.set(uri, { version: document.version, hash })
    return hash
  }


  get(document: vscode.TextDocument, position: vscode.Position, editHistoryHash: string,): ReplacementEdit | undefined {
    const documentUri = document.uri.toString();
    const contentHash = this.getContentHash(document)

    const key = createCacheKey(documentUri, contentHash, position.line, position.character, editHistoryHash);
    return this.cache.get(key)
  }

  set(document: vscode.TextDocument, position: vscode.Position, editHistoryHash: string, completion: ReplacementEdit) {
    const documentUri = document.uri.toString();
    const contentHash = this.getContentHash(document)

    const key = createCacheKey(documentUri, contentHash, position.line, position.character, editHistoryHash);
    this.cache.set(key, completion)
  }

  dispose() {
    throw new Error("dispose function is not being implemented");
  }
}
