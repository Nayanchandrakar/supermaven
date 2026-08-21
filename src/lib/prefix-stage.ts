import * as vscode from "vscode";

import { LSPService } from "@/services/lsp-service";
import { EnclosingScopes } from "@/types";
import { extractIdentifiers } from "@/utils/language";

export class PrefixStage {
  constructor(private readonly lspService: Pick<LSPService, "getDocumentSymbols">) {}

  async buildPrefix(document: vscode.TextDocument, position: vscode.Position) {
    if (position.line < 150) {
      return this.getVerbatimPrefix(document, position);
    }

    const scopes = await this.getEnclosingScopes(document, position);

    if (!scopes.enclosingFunction) {
      return this.buildSimplifiedPrefix(document, position, 150);
    }
  }

  private buildSimplifiedPrefix(
    document: vscode.TextDocument,
    position: vscode.Position,
    lineLimit: number
  ) {
    const cursorLine = position.line;
    const startLine = Math.max(0, cursorLine - lineLimit);

    const recentLines = this.collectLinesToCursor(document, startLine, position);
    const _usedIdentifiers = extractIdentifiers(recentLines.join("\n"), document.languageId);
  }

  private getUsedImports(document: vscode.TextDocument, _usedIdentifiers: Set<string>) {
    const _languageId = document.languageId;
  }

  async getEnclosingScopes(
    document: vscode.TextDocument,
    position: vscode.Position
  ): Promise<EnclosingScopes> {
    const symbols = await this.lspService.getDocumentSymbols(document);
    let enclosingFunction: vscode.DocumentSymbol | null = null;
    let enclosingClass: vscode.DocumentSymbol | null = null;
    let functionDepth = -1;
    let classDepth = -1;
    const symbolsByName = new Map<string, vscode.DocumentSymbol[]>();

    const findEnclosing = (symbols: vscode.DocumentSymbol[], depth: number) => {
      for (const symbol of symbols) {
        const existing = symbolsByName.get(symbol.name);
        if (existing) {
          existing.push(symbol);
          return;
        }
        symbolsByName.set(symbol.name, [symbol]);

        if (symbol.range.contains(position)) {
          if (this.isFunctionSymbol(symbol.kind) && depth >= functionDepth) {
            enclosingFunction = symbol;
            functionDepth = depth;
          }

          if (this.isClassSymbol(symbol.kind) && depth >= classDepth) {
            enclosingClass = symbol;
            classDepth = depth;
          }
        }

        if (symbol.children && symbol.children.length > 0) {
          findEnclosing(symbol.children, depth + 1);
        }
      }
    };

    findEnclosing(symbols, 0);
    return { enclosingClass, enclosingFunction, symbolsByName };
  }

  private isFunctionSymbol(kind: vscode.SymbolKind): boolean {
    return [
      vscode.SymbolKind.Function,
      vscode.SymbolKind.Method,
      vscode.SymbolKind.Constructor
    ].includes(kind);
  }

  private isClassSymbol(kind: vscode.SymbolKind): boolean {
    return [
      vscode.SymbolKind.Class,
      vscode.SymbolKind.Interface,
      vscode.SymbolKind.Struct,
      vscode.SymbolKind.Enum
    ].includes(kind);
  }

  getVerbatimPrefix(document: vscode.TextDocument, position: vscode.Position) {
    return this.collectLinesToCursor(document, 0, position).join("\n");
  }

  private collectLinesToCursor(
    document: vscode.TextDocument,
    startLine: number,
    position: vscode.Position
  ): string[] {
    if (startLine > position.line) {
      return [];
    }

    const lines: string[] = [];

    for (let i = startLine; i <= position.line; i++) {
      const lineText = document.lineAt(i).text;
      lines.push(i === position.line ? lineText.slice(0, position.character) : lineText);
    }

    return lines;
  }
}
