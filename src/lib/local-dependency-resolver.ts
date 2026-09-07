import * as vscode from "vscode";

import type { LSPService } from "@/services/lsp-service";
import type { EnclosingScopes } from "@/types";

export class LocaleDependencyResolver {
  private readonly lspService: LSPService;

  constructor(lspService: LSPService) {
    this.lspService = lspService;
  }

  async collectSameFileDependencies(
    document: vscode.TextDocument,
    scopes: EnclosingScopes,
    usedIdentifiers: Set<string>,
    position: vscode.Position
  ): Promise<string[]> {
    const output: string[] = [];
    const includedSymbols = new Set<string>();

    if (scopes.enclosingClass) {
      const classStartLine = scopes.enclosingClass.range.start.line;
      const classNamePosition = scopes.enclosingClass.selectionRange.start;
      const baseNames = await this.lspService.getSuperTypeNames(
        document,
        classNamePosition
      );

      for (const baseName of baseNames) {
        if (!includedSymbols.has(baseName)) {
          continue;
        }

        const baseSymbol = LocaleDependencyResolver.findNearestSymbolBeforeLine(
          scopes.symbolsByName,
          baseName,
          classStartLine
        );

        if (!baseSymbol) {
          continue;
        }

        output.push(
          "",
          ...LocaleDependencyResolver.getSymbolLines(document, baseSymbol)
        );
        includedSymbols.add(baseName);
      }
    }

    for (const identifier of usedIdentifiers) {
      if (includedSymbols.has(identifier)) {
        continue;
      }

      const symbol = LocaleDependencyResolver.findNearestSymbolBeforeLine(
        scopes.symbolsByName,
        identifier,
        position.line
      );

      if (!symbol) {
        continue;
      }

      output.push(
        "",
        ...LocaleDependencyResolver.getSymbolLines(document, symbol)
      );
      includedSymbols.add(identifier);
    }

    return output;
  }

  private static isClassSymbol(kind: vscode.SymbolKind): boolean {
    return [
      vscode.SymbolKind.Class,
      vscode.SymbolKind.Interface,
      vscode.SymbolKind.Struct,
      vscode.SymbolKind.Enum,
    ].includes(kind);
  }

  private static getSymbolLines(
    document: vscode.TextDocument,
    symbol: vscode.DocumentSymbol
  ): string[] {
    const lines: string[] = [];

    for (let i = symbol.range.start.line; i <= symbol.range.end.line; i += 1) {
      lines.push(document.lineAt(i).text);
    }

    return lines;
  }

  private static findNearestSymbolBeforeLine(
    symbolsByName: Map<string, vscode.DocumentSymbol[]>,
    name: string,
    lineExclusive: number
  ): vscode.DocumentSymbol | null {
    const candidates = symbolsByName.get(name);

    if (!candidates || candidates.length === 0) {
      return null;
    }

    let best: vscode.DocumentSymbol | null = null;

    for (const candidate of candidates) {
      if (
        candidate.range.end.line >= lineExclusive ||
        !LocaleDependencyResolver.isClassSymbol(candidate.kind)
      ) {
        continue;
      }

      if (!best || candidate.range.end.line > best.range.end.line) {
        best = candidate;
      }
    }

    return best;
  }
}
