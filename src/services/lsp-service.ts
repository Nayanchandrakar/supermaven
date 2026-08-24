import * as vscode from "vscode";
import { BoundedCache } from "@/cache/bounded-cache";
import { DefinitionTarget, RawTypeHeirarchyItems } from "@/types";
import { createCacheKey } from "@/utils/create-cache-key";
import { getConfigService } from "./config-service";

export class LSPService implements vscode.Disposable {
  private readonly disposables: vscode.Disposable[] = [];
  private currentMaxEntries: number;
  private cache: BoundedCache<unknown>;

  constructor() {
    const config = getConfigService();
    this.currentMaxEntries = config.lspCacheMaxEntries;
    this.cache = new BoundedCache(this.currentMaxEntries);

    this.disposables.push(
      config.onConfigChange((config) => {
        if (config.lspCacheMaxEntries !== this.currentMaxEntries) {
          this.cache = new BoundedCache(config.lspCacheMaxEntries);
          this.currentMaxEntries = config.lspCacheMaxEntries;
        }
      })
    );

    this.registerListeners();
  }

  private registerListeners() {
    this.disposables.push(
      vscode.workspace.onDidChangeTextDocument((e) => {
        this.cache.invalidateGroup(e.document.uri.toString());
      }),
      vscode.workspace.onDidCloseTextDocument((doc) => {
        this.cache.invalidateGroup(doc.uri.toString());
      })
    );
  }

  async getDocumentSymbols(document: vscode.TextDocument): Promise<vscode.DocumentSymbol[]> {
    const documentUri = document.uri.toString();

    const cacheKey = createCacheKey(documentUri, "documentSymbols");

    const cached = this.cache.get(cacheKey) as vscode.DocumentSymbol[] | undefined;

    if (cached !== undefined) {
      return cached;
    }

    try {
      const symbols: vscode.DocumentSymbol[] = await vscode.commands.executeCommand(
        "vscode.executeDocumentSymbolProvider",
        document.uri
      );

      this.cache.set(cacheKey, symbols, { groupKey: documentUri });
      return symbols;
    } catch {
      return [];
    }
  }

  async getSuperTypeNames(
    document: vscode.TextDocument,
    position: vscode.Position
  ): Promise<string[]> {
    const documentUri = document.uri.toString();

    const cacheKey = createCacheKey(
      documentUri,
      "superTypes",
      `${position.line}:${position.character}`
    );

    const cached = this.cache.get(cacheKey) as string[] | undefined;

    if (cached !== undefined) {
      return cached;
    }

    const prepared = await vscode.commands.executeCommand<RawTypeHeirarchyItems>(
      "vscode.prepareTypeHeirarchy",
      documentUri,
      position
    );

    if (!prepared) {
      return [];
    }

    const roots: DefinitionTarget[] = Array.isArray(prepared) ? prepared : [prepared];

    try {
      const superTypeResults = await Promise.allSettled(
        roots.map((item) =>
          vscode.commands.executeCommand<vscode.TypeHierarchyItem[]>(
            "vscode.providerSuperTypes",
            item
          )
        )
      );

      const names: string[] = [];

      for (const result of superTypeResults) {
        if (result.status !== "fulfilled" || !result.value) {
          continue;
        }

        for (const item of result.value) {
          names.push(item.name);
        }
      }

      const unique = [...new Set(names)];
      this.cache.set(cacheKey, unique, { groupKey: documentUri });

      return unique;
    } catch {
      return [];
    }
  }

  dispose() {
    this.disposables.forEach((d) => d.dispose());
    this.cache.clear();
  }
}
