import * as vscode from "vscode";

import type { AstService } from "@/services/ast-service";
import type { ReplacementRegion } from "@/types";
import { findStatementEnd } from "@/utils/ast-analysis";

export class ReplacementRegionStage {
  private readonly astService: AstService;

  constructor(astService: AstService) {
    this.astService = astService;
  }

  compute(
    document: vscode.TextDocument,
    position: vscode.Position
  ): ReplacementRegion {
    const currentLine = document.lineAt(position.line).text;
    let textAfterCursor = currentLine.slice(position.character);

    let endLine = position.line;
    let endChar = currentLine.length;

    const shouldTryExtension =
      textAfterCursor.trim().length > 0 &&
      ReplacementRegionStage.shouldExtendRegion(textAfterCursor);

    if (shouldTryExtension && textAfterCursor.length < 200) {
      const extension = this.extendToStatementEnd(
        document,
        position,
        200 - textAfterCursor.length,
        3
      );

      if (extension) {
        ({ endChar, endLine, text: textAfterCursor } = extension);
      }
    }

    return {
      range: new vscode.Range(position, new vscode.Position(endLine, endChar)),
      text: textAfterCursor,
    };
  }

  private static shouldExtendRegion(textAfterCursor: string): boolean {
    const trimmed = textAfterCursor.trim();

    if (trimmed.length === 0) {
      return false;
    }

    const opens = (trimmed.match(/[([{]/gu) || []).length;
    const closes = (trimmed.match(/[)\]}]/gu) || []).length;

    if (opens > closes) {
      return true;
    }

    const continuationEndings = [
      ",",
      "+",
      "-",
      "*",
      "/",
      "&&",
      "||",
      "|",
      "&",
      ".",
      "->",
      "\\",
      "=",
      "+=",
      "-=",
      "*=",
      "/=",
      "%=",
      "&=",
      "|=",
      "^=",
      ">>=",
      "<<=",
      "**=",
      "//=",
      "...",
      "?",
      ":",
    ];
    for (const ending of continuationEndings) {
      if (trimmed.endsWith(ending)) {
        return true;
      }
    }

    if (trimmed.length < 20) {
      const statementTerminators = [";", "{", "}", ":"];
      const endsWithTerminator = statementTerminators.some((terminator) =>
        trimmed.endsWith(terminator)
      );
      if (!endsWithTerminator) {
        return true;
      }
    }

    return false;
  }

  private extendToStatementEnd(
    document: vscode.TextDocument,
    position: vscode.Position,
    maxChars: number,
    maxLines: number
  ): { text: string; endLine: number; endChar: number } | null {
    const startLine = position.line;
    const endLine = Math.min(document.lineCount - 1, startLine + maxLines);

    const lines: string[] = [];
    for (let i = startLine; i <= endLine; i += 1) {
      lines.push(document.lineAt(i).text);
    }
    const regionText = lines.join("\n");
    return this.astService.withParsedTree(regionText, (tree) => {
      const result = findStatementEnd(tree, {
        column: position.character,
        row: 0,
      });

      if (!result) {
        return null;
      }

      const absoluteEndLine = startLine + result.endLine;
      const absoluteEndChar = result.endChar;

      let text = document.lineAt(startLine).text.slice(position.character);
      for (let i = startLine + 1; i <= absoluteEndLine; i += 1) {
        text += `\n${document.lineAt(i).text}`;
      }

      if (text.length > maxChars) {
        return null;
      }

      return { endChar: absoluteEndChar, endLine: absoluteEndLine, text };
    });
  }
}
