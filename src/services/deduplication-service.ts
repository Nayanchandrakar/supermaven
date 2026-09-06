import * as vscode from "vscode";
import { DedupOutput } from "@/types";
import { normalizeText, stringSimilarity } from "@/utils/language";

export class DeduplicationService {
  check(document: vscode.TextDocument, position: vscode.Position, completion: string): DedupOutput {
    if (!completion.trim()) {
      return { proceed: true, completion };
    }

    completion = this.trimLookbehindOverlap(document, position, completion);
    if (!completion.trim()) {
      return {
        proceed: false,
        completion,
        reasonText: "All completion lines already exist above cursor"
      };
    }

    const lookahead = this.buildLookahead(document, position);
    if (!lookahead.trim()) {
      return { proceed: true, completion };
    }

    if (this.hasStructuralOverlap(completion, lookahead)) {
      return {
        proceed: false,
        completion,
        reasonText: "Completion duplicates existing code below cursor"
      };
    }

    if (this.hasTrailingOverlap(completion, document, position)) {
      return {
        proceed: false,
        completion,
        reasonText: "Trailing completion lines duplicate code below cursor"
      };
    }

    return { proceed: true, completion };
  }

  private trimLookbehindOverlap(
    document: vscode.TextDocument,
    position: vscode.Position,
    completion: string
  ): string {
    const allLines = completion.split("\n");
    const nonEmpty: { norm: string; idx: number }[] = [];

    for (let i = 0; i < allLines.length; i++) {
      if (allLines[i]!.trim()) {
        nonEmpty.push({ norm: normalizeText(allLines[i]!), idx: i });
      }
    }

    if (nonEmpty.length == 0) return completion;

    const lookbehind: string[] = [];

    for (let line = position.line; line >= 0 && lookbehind.length < 200; line--) {
      const text =
        line == position.line
          ? document.lineAt(line).text.slice(0, position.character)
          : document.lineAt(line).text;

      if (text.trim()) {
        lookbehind.push(normalizeText(text));
      }
    }

    lookbehind.reverse();
    if (lookbehind.length === 0) return completion;

    const prefix = document.lineAt(position.line).text.slice(0, position.character);
    const variants: string[][] = [nonEmpty.map((e) => e.norm)];

    if (nonEmpty[0]!.idx === 0 && prefix.trim()) {
      const merged = normalizeText(prefix + allLines[0]);
      if (merged !== nonEmpty[0]!.norm) {
        variants.push([merged, ...nonEmpty.slice(1).map((e) => e.norm)]);
      }
    }

    const windowStart = Math.max(0, lookbehind.length - 5);

    let bestMatch = 0;

    for (let start = lookbehind.length - 1; start >= windowStart; start--) {
      const maxCompare = Math.min(nonEmpty.length, lookbehind.length - start);
      for (const variant of variants) {
        let matched = 0;
        while (matched < maxCompare && variant[matched] === lookbehind[start + matched]) {
          matched++;
        }
        if (matched > bestMatch) {
          bestMatch = matched;
        }
      }
    }

    if (bestMatch === 0) return completion;

    return allLines.slice(nonEmpty[bestMatch - 1]!.idx + 1).join("\n");
  }

  private buildLookahead(document: vscode.TextDocument, position: vscode.Position): string {
    const suffix = document.lineAt(position.line).text.slice(position.character);
    const lines: string[] = [];
    const end = Math.min(document.lineCount - 1, position.line + 100);

    for (let i = position.line + 1; i <= end; i++) {
      lines.push(document.lineAt(i).text);
    }
    const below = lines.join("\n");

    return suffix && below ? `${suffix}\n${below}` : suffix || below;
  }

  private hasStructuralOverlap(completion: string, lookahead: string): boolean {
    const compLines = completion
      .split("\n")
      .filter((l) => l.trim())
      .map(normalizeText);
    const aheadLines = lookahead
      .split("\n")
      .filter((l) => l.trim())
      .map(normalizeText);

    if (compLines.length <= 1 || aheadLines.length < 2) return false;

    for (let i = 0; i <= aheadLines.length - 2; i++) {
      let matched = 0;
      for (let j = 0; j < compLines.length && i + j < aheadLines.length; j++) {
        if (stringSimilarity(compLines[j]!, aheadLines[i + j]!) >= 0.85) {
          matched++;
        } else if (matched > 0) {
          break;
        }
      }
      if (matched >= 2) return true;
    }

    return false;
  }

  private hasTrailingOverlap(
    completionText: string,
    document: vscode.TextDocument,
    position: vscode.Position
  ): boolean {
    /**
     * Trailing overlap example:
     *
     * Existing code: 10| return x; 11| }
     *
     * Model completion: " return x;\n}\n"
     *
     * If we already kept " return x;" from earlier checks, we now look at the **end** of the
     * completion ("}\n") and compare it to the **start** of the code after the cursor ("}\n").
     * If they match, we should **not** insert another "}", because it is already there.
     */
    const compLines = completionText.split("\n");
    const trailing: string[] = [];
    for (let i = compLines.length - 1; i >= 0 && trailing.length < 5; i--) {
      if (compLines[i]!.trim()) trailing.unshift(normalizeText(compLines[i]!));
    }
    if (trailing.length === 0) return false;

    // Build the list of **leading** lines starting at the cursor:
    // - any text to the right of the cursor on the current line
    // - then the next non‑empty lines below (up to 100)
    const leading: string[] = [];
    const suffix = document.lineAt(position.line).text.slice(position.character);
    if (suffix.trim()) leading.push(normalizeText(suffix));
    const end = Math.min(document.lineCount - 1, position.line + 200);
    for (let i = position.line + 1; i <= end && leading.length < 100; i++) {
      if (document.lineAt(i).text.trim()) {
        leading.push(normalizeText(document.lineAt(i).text));
      }
    }
    if (leading.length === 0) return false;

    // Now check if the last 1 line of the completion matches the first 1 line of the lookahead,
    // or the last 2 lines match the first 2 lines, and so on.
    const maxN = Math.min(trailing.length, leading.length);

    for (let n = maxN; n >= 1; n--) {
      const tail = trailing.slice(-n);
      let match = true;
      for (let i = 0; i < n; i++) {
        if (tail[i] !== leading[i]) {
          match = false;
          break;
        }
      }
      if (match) return true;
    }
    return false;
  }
}
