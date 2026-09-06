import * as vscode from "vscode";
import { BoundedCache } from "@/cache/bounded-cache";
import { AstService } from "@/services/ast-service";
import type { IndexedSymbol } from "@/types";
import { extractSignatureFromAST } from "@/utils/ast-analysis";
import { createCacheKey } from "@/utils/create-cache-key";

export class SignatureProvider {
  private readonly signatureCache: BoundedCache<string>;

  constructor(private readonly astService: AstService) {
    this.signatureCache = new BoundedCache<string>(1000);
  }

  async extract(symbols: IndexedSymbol[]): Promise<IndexedSymbol[]> {
    const res: IndexedSymbol[] = [];

    for (const symbol of symbols) {
      // oxlint-disable-next-line no-await-in-loop
      const signature = await this.extractSignature(symbol);
      if (!signature) {
        continue;
      }

      res.push({ ...symbol, signature });
    }

    return res;
  }

  private async extractSignature(symbol: IndexedSymbol): Promise<string | undefined> {
    const cacheKey = createCacheKey(
      "signatureProvider",
      symbol.uri,
      symbol.kind,
      symbol.name,
      symbol.range.startLine,
      symbol.range.startCharacter,
      symbol.range.endLine,
      symbol.range.endCharacter
    );

    const cached = this.signatureCache.get(cacheKey);
    if (cached !== undefined) {
      return cached;
    }

    const uri = vscode.Uri.parse(symbol.uri);

    const document = await vscode.workspace.openTextDocument(uri);

    const range = new vscode.Range(
      symbol.range.startLine,
      symbol.range.startCharacter,
      symbol.range.endLine,
      symbol.range.endCharacter
    );
    const fullText = document.getText(range);

    const signature = this.astService.withParsedTree(fullText, (tree) =>
      extractSignatureFromAST(tree, symbol.kind)
    );

    if (signature) {
      this.signatureCache.set(cacheKey, signature, { groupKey: symbol.uri });
      return signature;
    } else {
      return undefined;
    }
  }

  clear(): void {
    this.signatureCache.clear();
  }
}
