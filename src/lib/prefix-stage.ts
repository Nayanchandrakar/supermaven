import * as vscode from "vscode";

import type { LocaleDependencyResolver } from "@/lib/local-dependency-resolver";
import type { LSPService } from "@/services/lsp-service";
import type { EnclosingScopes } from "@/types";
import {
  findImportLineSpans,
  parseImportBindings,
} from "@/utils/import-analysis";
import { extractIdentifiers, getTruncationMarker } from "@/utils/language";

export class PrefixStage {
  private readonly lspService: LSPService;
  private readonly outputChannel: vscode.OutputChannel;
  private readonly localDependencyResolve: LocaleDependencyResolver;

  constructor(
    lspService: LSPService,
    outputChannel: vscode.OutputChannel,
    localDependencyResolve: LocaleDependencyResolver
  ) {
    this.lspService = lspService;
    this.outputChannel = outputChannel;
    this.localDependencyResolve = localDependencyResolve;
  }

  async buildPrefix(
    document: vscode.TextDocument,
    position: vscode.Position
  ): Promise<string> {
    if (position.line < 150) {
      return PrefixStage.getVerbatimPrefix(document, position);
    }

    const scopes = await this.getEnclosingScopes(document, position);

    if (!scopes.enclosingFunction) {
      return PrefixStage.buildSimplifiedPrefix(document, position, 150);
    }

    const functionStartLine = scopes.enclosingFunction.range.start.line;
    const linesFromFunctionStart = position.line - functionStartLine >= 150;

    return this.buildScopedPrefix(
      document,
      position,
      scopes,
      linesFromFunctionStart
    );
  }

  private async buildScopedPrefix(
    document: vscode.TextDocument,
    position: vscode.Position,
    scopes: EnclosingScopes,
    isLargeFunction: boolean
  ): Promise<string> {
    const cursorLine = position.line;

    const functionStartLine =
      scopes.enclosingFunction?.range.start.line ?? cursorLine;
    const classHeaderLines = PrefixStage.collectClassHeaderLines(
      document,
      scopes,
      functionStartLine
    );

    this.logger(classHeaderLines.join("\n"));

    if (!isLargeFunction) {
      const functionLines = PrefixStage.collectLinesToCursor(
        document,
        functionStartLine,
        position
      );

      const usedIdentifiers = extractIdentifiers(
        [...classHeaderLines, ...functionLines].join("\n"),
        document.languageId
      );

      const usedImports = PrefixStage.getUsedImports(document, usedIdentifiers);
      const sameFileDeps =
        await this.localDependencyResolve.collectSameFileDependencies(
          document,
          scopes,
          usedIdentifiers,
          position
        );

      return PrefixStage.assemblePrefixParts(
        usedImports,
        sameFileDeps,
        classHeaderLines,
        functionLines
      ).join("\n");
    }

    const functionSetupEnd = Math.min(functionStartLine + 30, cursorLine);
    const recentContextStart = Math.max(functionSetupEnd + 1, cursorLine - 100);

    const functionSetupLines = PrefixStage.collectLinesToCursor(
      document,
      functionStartLine,
      new vscode.Position(functionSetupEnd + 1, 0)
    );
    const recentContextLines = PrefixStage.collectLinesToCursor(
      document,
      recentContextStart,
      new vscode.Position(position.line + 1, 0)
    );

    const usedIdentifiers = extractIdentifiers(
      [...classHeaderLines, ...functionSetupLines, recentContextLines].join(
        "\n"
      ),
      document.languageId
    );

    const usedImports = PrefixStage.getUsedImports(document, usedIdentifiers);
    const sameFileDeps =
      await this.localDependencyResolve.collectSameFileDependencies(
        document,
        scopes,
        usedIdentifiers,
        position
      );

    const output = PrefixStage.assemblePrefixParts(
      usedImports,
      sameFileDeps,
      classHeaderLines,
      functionSetupLines
    );

    if (recentContextLines.length > 0) {
      const skippedLines = recentContextStart - functionSetupEnd;

      if (skippedLines > 0) {
        output.push(getTruncationMarker(document.languageId, skippedLines));
      }

      output.push(...recentContextLines);
    }

    return output.join("\n");
  }

  private static collectClassHeaderLines(
    document: vscode.TextDocument,
    scopes: EnclosingScopes,
    functionStartLine: number
  ): string[] {
    const classStartLine = scopes.enclosingClass?.range.start.line;

    if (classStartLine === undefined || classStartLine >= functionStartLine) {
      return [];
    }

    const classHeaderEnd = PrefixStage.findClassHeaderEnd(
      document,
      classStartLine
    );

    return PrefixStage.collectLinesToCursor(
      document,
      classStartLine,
      new vscode.Position(classHeaderEnd + 1, 0)
    );
  }

  private static findClassHeaderEnd(
    document: vscode.TextDocument,
    classStartLine: number
  ): number {
    if (document.languageId === "python") {
      for (let i = classStartLine; i < document.lineCount; i += 1) {
        if (document.lineAt(i).text.includes(":")) {
          return i;
        }
      }
      return classStartLine;
    }

    for (
      let i = classStartLine;
      i < Math.min(classStartLine + 10, document.lineCount);
      i += 1
    ) {
      if (document.lineAt(i).text.includes("{")) {
        return i;
      }
    }

    return classStartLine;
  }

  private static buildSimplifiedPrefix(
    document: vscode.TextDocument,
    position: vscode.Position,
    lineLimit: number
  ) {
    const cursorLine = position.line;
    const startLine = Math.max(0, cursorLine - lineLimit);

    const recentLines = PrefixStage.collectLinesToCursor(
      document,
      startLine,
      position
    );
    const usedIdentifiers = extractIdentifiers(
      recentLines.join("\n"),
      document.languageId
    );

    const usedImports = PrefixStage.getUsedImports(document, usedIdentifiers);

    return PrefixStage.assemblePrefixParts(
      usedImports,
      [],
      [],
      recentLines
    ).join("\n");
  }

  private static assemblePrefixParts(
    usedImports: string[],
    sameFileDeps: string[],
    classHeaderLines: string[],
    primaryLines: string[]
  ): string[] {
    const output: string[] = [];

    if (usedImports.length > 0) {
      output.push(...usedImports);
    }

    if (sameFileDeps.length > 0) {
      output.push(...sameFileDeps);
    }

    if (classHeaderLines.length > 0) {
      output.push(...classHeaderLines);
    }

    if (primaryLines.length > 0) {
      output.push(...primaryLines);
    }

    return output;
  }

  private static isAlwaysIncludedImportSpan(
    lines: string[],
    languageId: string
  ): boolean {
    if (languageId !== "go" && languageId !== "java") {
      return false;
    }
    const firstNonEmpty = lines.find((line) => line.trim() !== "")?.trim();
    return firstNonEmpty?.startsWith("package ") ?? false;
  }

  private static getUsedImports(
    document: vscode.TextDocument,
    usedIdentifiers: Set<string>
  ): string[] {
    const { languageId } = document;
    const importSpans = findImportLineSpans(document.getText(), languageId);

    if (importSpans.length === 0) {
      return [];
    }

    const usedImports: string[] = [];

    for (const span of importSpans) {
      const importLines: string[] = [];

      for (
        let i = span.start;
        i <= span.end && i < document.lineCount;
        i += 1
      ) {
        importLines.push(document.lineAt(i).text);
      }

      const importText = importLines.join("\n");

      if (PrefixStage.isAlwaysIncludedImportSpan(importLines, languageId)) {
        usedImports.push(...importLines);
        continue;
      }

      if (usedIdentifiers.size === 0) {
        continue;
      }

      const bindings = parseImportBindings(importText, languageId);

      const providedNames = [...bindings.importedLocalNames];

      const isUsed = providedNames.some((name) => usedIdentifiers.has(name));

      if (isUsed) {
        usedImports.push(...importLines);
      }
    }

    return usedImports;
  }

  async getEnclosingScopes(
    document: vscode.TextDocument,
    position: vscode.Position
  ): Promise<EnclosingScopes> {
    const documentSymbols = await this.lspService.getDocumentSymbols(document);
    let enclosingFunction: vscode.DocumentSymbol | null = null;
    let enclosingClass: vscode.DocumentSymbol | null = null;
    let functionDepth = -1;
    let classDepth = -1;
    const symbolsByName = new Map<string, vscode.DocumentSymbol[]>();

    const findEnclosing = (
      symbols: vscode.DocumentSymbol[],
      depth: number
    ): void => {
      for (const symbol of symbols) {
        const existing = symbolsByName.get(symbol.name);
        if (existing) {
          existing.push(symbol);
          return;
        }
        symbolsByName.set(symbol.name, [symbol]);

        if (symbol.range.contains(position)) {
          if (
            PrefixStage.isFunctionSymbol(symbol.kind) &&
            depth >= functionDepth
          ) {
            enclosingFunction = symbol;
            functionDepth = depth;
          }

          if (PrefixStage.isClassSymbol(symbol.kind) && depth >= classDepth) {
            enclosingClass = symbol;
            classDepth = depth;
          }
        }

        if (symbol.children && symbol.children.length > 0) {
          findEnclosing(symbol.children, depth + 1);
        }
      }
    };

    findEnclosing(documentSymbols, 0);
    return { enclosingClass, enclosingFunction, symbolsByName };
  }

  private static isFunctionSymbol(kind: vscode.SymbolKind): boolean {
    return [
      vscode.SymbolKind.Function,
      vscode.SymbolKind.Method,
      vscode.SymbolKind.Constructor,
    ].includes(kind);
  }

  private static isClassSymbol(kind: vscode.SymbolKind): boolean {
    return [
      vscode.SymbolKind.Class,
      vscode.SymbolKind.Interface,
      vscode.SymbolKind.Struct,
      vscode.SymbolKind.Enum,
    ].includes(kind);
  }

  static getVerbatimPrefix(
    document: vscode.TextDocument,
    position: vscode.Position
  ) {
    return PrefixStage.collectLinesToCursor(document, 0, position).join("\n");
  }

  private logger(message: string) {
    this.outputChannel.appendLine(`[Prefix-stage] ${message}`);
  }

  private static collectLinesToCursor(
    document: vscode.TextDocument,
    startLine: number,
    position: vscode.Position
  ): string[] {
    if (startLine > position.line) {
      return [];
    }

    const lines: string[] = [];

    for (let i = startLine; i <= position.line; i += 1) {
      const lineText = document.lineAt(i).text;
      lines.push(
        i === position.line ? lineText.slice(0, position.character) : lineText
      );
    }

    return lines;
  }
}
