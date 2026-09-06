import * as vscode from "vscode";
import { BoundedCache } from "@/cache/bounded-cache";
import { LSPService } from "@/services/lsp-service";
import { IndexedSymbol } from "@/types";
import { createCacheKey } from "@/utils/create-cache-key";

export class SymbolIndex {
  private readonly cache: BoundedCache<{ version: number; symbols: IndexedSymbol[] }>;
  private readonly trackedUris: Set<string> = new Set();

  constructor(private readonly lspService: LSPService) {
    this.cache = new BoundedCache(1000);
  }

  getAllSymbols() {
    const result: IndexedSymbol[] = [];

    for (const uri of Array.from(this.trackedUris)) {
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
    this.cache.set(cachedKey, { version: document.version, symbols: indexedSymbols });
    this.trackedUris.add(uri);
  }

  private extractSymbols(
    symbols: vscode.DocumentSymbol[],
    uri: string,
    containerName?: string
  ): IndexedSymbol[] {
    const result: IndexedSymbol[] = [];

    for (const symbol of symbols) {
      if (this.isRelevantSymbolKind(symbol.kind)) {
        result.push({
          name: symbol.name,
          kind: symbol.kind,
          containerName: containerName!,
          uri,
          range: {
            startLine: symbol.range.start.line,
            startCharacter: symbol.range.start.character,
            endLine: symbol.range.end.line,
            endCharacter: symbol.range.end.character
          }
        });
      }

      if (symbol.children && symbol.children.length > 0) {
        const childContainer = containerName ? `${containerName}.${symbol.name}` : symbol.name;
        result.push(...this.extractSymbols(symbol.children, uri, childContainer));
      }
    }

    return result;
  }

  private isRelevantSymbolKind(kind: vscode.SymbolKind): boolean {
    return [
      vscode.SymbolKind.Class,
      vscode.SymbolKind.Interface,
      vscode.SymbolKind.Enum,
      vscode.SymbolKind.Function,
      vscode.SymbolKind.Method,
      vscode.SymbolKind.Property,
      vscode.SymbolKind.Constant,
      vscode.SymbolKind.TypeParameter,
      vscode.SymbolKind.Struct
    ].includes(kind);
  }

  clear(): void {
    this.cache.clear();
    this.trackedUris.clear();
  }
}
