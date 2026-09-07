import type * as vscode from "vscode";

export class SuffixStage {
  // oxlint-disable-next-line class-methods-use-this
  buildSuffixAfterRegion(
    document: vscode.TextDocument,
    position: vscode.Position
  ) {
    const output: string[] = [
      document.lineAt(position.line).text.slice(position.character),
    ];

    const startLine = position.line + 1;

    for (
      let i = startLine;
      i < Math.min(document.lineCount, position.line + 3 + 1);
      i += 1
    ) {
      const lineText = document.lineAt(i).text;

      const trimmedLine = lineText.trim();

      if (trimmedLine === "") {
        continue;
      } else if (trimmedLine.replaceAll(/[{}[\]()=;,.>]/gu, "").trim() === "") {
        output.push(lineText);
      } else {
        break;
      }
    }

    return output.join("\n");
  }
}
