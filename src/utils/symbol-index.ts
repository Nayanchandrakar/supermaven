import * as vscode from "vscode";

import { BoundedCache } from "@/cache/bounded-cache";
import type { LSPService } from "@/services/lsp-service";
import type { IndexedSymbol } from "@/types";
import { createCacheKey } from "@/utils/create-cache-key";

export class SymbolIndex {
  private readonly cache: BoundedCache<{
    version: number;
    symbols: IndexedSymbol[];
  }>;
  private readonly trackedUris = new Set<string>();
  private readonly lspService: LSPService;

  constructor(lspService: LSPService) {
    this.lspService = lspService;
    this.cache = new BoundedCache(1000);
  }

  getAllSymbols() {
    const result: IndexedSymbol[] = [];

    for (const uri of this.trackedUris) {
      const cachedKey = createCacheKey("symbolIndex", uri);
      const entry = this.cache.get(cachedKey);
      if (!entry) {
        this.trackedUris.delete(cachedKey);
        continue;
      }

      if (entry.symbols.length > 0) {
        result.push(...entry.symbols);
      }
    }

    return result;
  }

  async indexDocument(document: vscode.TextDocument): Promise<void> {
    if (document.uri.scheme !== "file") {
      return;
    }
    const uri = document.uri.toString();
    const cachedKey = createCacheKey("symbolIndex", uri);
    const cached = this.cache.get(cachedKey);
    if (cached && cached.version === document.version) {
      return;
    }

    const symbols = await this.lspService.getDocumentSymbols(document);
    const indexedSymbols = this.extractSymbols(symbols, uri);
    this.cache.set(cachedKey, {
      symbols: indexedSymbols,
      version: document.version,
    });
    this.trackedUris.add(uri);
  }

  private extractSymbols(
    symbols: vscode.DocumentSymbol[],
    uri: string,
    containerName?: string
  ): IndexedSymbol[] {
    const result: IndexedSymbol[] = [];

    for (const symbol of symbols) {
      if (SymbolIndex.isRelevantSymbolKind(symbol.kind)) {
        result.push({
          containerName: containerName ?? "",
          kind: symbol.kind,
          name: symbol.name,
          range: {
            endCharacter: symbol.range.end.character,
            endLine: symbol.range.end.line,
            startCharacter: symbol.range.start.character,
            startLine: symbol.range.start.line,
          },
          uri,
        });
      }

      if (symbol.children && symbol.children.length > 0) {
        const childContainer = containerName
          ? `${containerName}.${symbol.name}`
          : symbol.name;
        result.push(
          ...this.extractSymbols(symbol.children, uri, childContainer)
        );
      }
    }

    return result;
  }

  private static isRelevantSymbolKind(kind: vscode.SymbolKind): boolean {
    return [
      vscode.SymbolKind.Class,
      vscode.SymbolKind.Interface,
      vscode.SymbolKind.Enum,
      vscode.SymbolKind.Function,
      vscode.SymbolKind.Method,
      vscode.SymbolKind.Property,
      vscode.SymbolKind.Constant,
      vscode.SymbolKind.TypeParameter,
      vscode.SymbolKind.Struct,
    ].includes(kind);
  }

  clear(): void {
    this.cache.clear();
    this.trackedUris.clear();
  }
}
