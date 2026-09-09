import type * as vscode from "vscode";

import type { DedupOutput } from "@/types";
import { normalizeText, stringSimilarity } from "@/utils/language";

export class DeduplicationService {
  // oxlint-disable-next-line class-methods-use-this
  check(
    document: vscode.TextDocument,
    position: vscode.Position,
    initialCompletion: string
  ): DedupOutput {
    if (!initialCompletion.trim()) {
      return { completion: initialCompletion, proceed: true };
    }

    const completion = DeduplicationService.trimLookbehindOverlap(
      document,
      position,
      initialCompletion
    );
    if (!completion.trim()) {
      return {
        completion,
        proceed: false,
        reasonText: "All completion lines already exist above cursor",
      };
    }

    const lookahead = DeduplicationService.buildLookahead(document, position);
    if (!lookahead.trim()) {
      return { completion, proceed: true };
    }

    if (DeduplicationService.hasStructuralOverlap(completion, lookahead)) {
      return {
        completion,
        proceed: false,
        reasonText: "Completion duplicates existing code below cursor",
      };
    }

    if (
      DeduplicationService.hasTrailingOverlap(completion, document, position)
    ) {
      return {
        completion,
        proceed: false,
        reasonText: "Trailing completion lines duplicate code below cursor",
      };
    }

    return { completion, proceed: true };
  }

  private static trimLookbehindOverlap(
    document: vscode.TextDocument,
    position: vscode.Position,
    completion: string
  ): string {
    const allLines = completion.split("\n");
    const nonEmpty: { norm: string; idx: number }[] = [];

    for (let i = 0; i < allLines.length; i += 1) {
      const line = allLines[i];
      if (line?.trim()) {
        nonEmpty.push({ idx: i, norm: normalizeText(line) });
      }
    }

    if (nonEmpty.length === 0) {
      return completion;
    }

    const lookbehind: string[] = [];

    for (
      let { line } = position;
      line >= 0 && lookbehind.length < 200;
      line -= 1
    ) {
      const text =
        line === position.line
          ? document.lineAt(line).text.slice(0, position.character)
          : document.lineAt(line).text;

      if (text.trim()) {
        lookbehind.push(normalizeText(text));
      }
    }

    lookbehind.reverse();
    if (lookbehind.length === 0) {
      return completion;
    }

    const prefix = document
      .lineAt(position.line)
      .text.slice(0, position.character);
    const variants: string[][] = [nonEmpty.map((e) => e.norm)];

    const [firstNonEmpty] = nonEmpty;
    if (firstNonEmpty?.idx === 0 && prefix.trim()) {
      const merged = normalizeText(prefix + allLines[0]);
      if (merged !== firstNonEmpty.norm) {
        variants.push([merged, ...nonEmpty.slice(1).map((e) => e.norm)]);
      }
    }

    const bestMatch = DeduplicationService.findBestLookbehindMatch(
      variants,
      nonEmpty.length,
      lookbehind
    );

    if (bestMatch === 0) {
      return completion;
    }

    const bestMatchEntry = nonEmpty[bestMatch - 1];
    return bestMatchEntry
      ? allLines.slice(bestMatchEntry.idx + 1).join("\n")
      : completion;
  }

  private static findBestLookbehindMatch(
    variants: string[][],
    nonEmptyCount: number,
    lookbehind: string[]
  ): number {
    const windowStart = Math.max(0, lookbehind.length - 5);
    let bestMatch = 0;

    for (let start = lookbehind.length - 1; start >= windowStart; start -= 1) {
      const maxCompare = Math.min(nonEmptyCount, lookbehind.length - start);
      for (const variant of variants) {
        let matched = 0;
        while (
          matched < maxCompare &&
          variant[matched] === lookbehind[start + matched]
        ) {
          matched += 1;
        }
        if (matched > bestMatch) {
          bestMatch = matched;
        }
      }
    }

    return bestMatch;
  }

  private static buildLookahead(
    document: vscode.TextDocument,
    position: vscode.Position
  ): string {
    const suffix = document
      .lineAt(position.line)
      .text.slice(position.character);
    const lines: string[] = [];
    const end = Math.min(document.lineCount - 1, position.line + 100);

    for (let i = position.line + 1; i <= end; i += 1) {
      lines.push(document.lineAt(i).text);
    }
    const below = lines.join("\n");

    return suffix && below ? `${suffix}\n${below}` : suffix || below;
  }

  private static hasStructuralOverlap(
    completion: string,
    lookahead: string
  ): boolean {
    const compLines = completion
      .split("\n")
      .filter((l) => l.trim())
      .map(normalizeText);
    const aheadLines = lookahead
      .split("\n")
      .filter((l) => l.trim())
      .map(normalizeText);

    if (compLines.length <= 1 || aheadLines.length < 2) {
      return false;
    }

    for (let i = 0; i <= aheadLines.length - 2; i += 1) {
      let matched = 0;
      for (
        let j = 0;
        j < compLines.length && i + j < aheadLines.length;
        j += 1
      ) {
        const compLine = compLines[j];
        const aheadLine = aheadLines[i + j];
        if (
          compLine &&
          aheadLine &&
          stringSimilarity(compLine, aheadLine) >= 0.85
        ) {
          matched += 1;
        } else if (matched > 0) {
          break;
        }
      }
      if (matched >= 2) {
        return true;
      }
    }

    return false;
  }

  private static hasTrailingOverlap(
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
    for (let i = compLines.length - 1; i >= 0 && trailing.length < 5; i -= 1) {
      const compLine = compLines[i];
      if (compLine?.trim()) {
        trailing.unshift(normalizeText(compLine));
      }
    }
    if (trailing.length === 0) {
      return false;
    }

    // Build the list of **leading** lines starting at the cursor:
    // - any text to the right of the cursor on the current line
    // - then the next non‑empty lines below (up to 100)
    const leading: string[] = [];
    const suffix = document
      .lineAt(position.line)
      .text.slice(position.character);
    if (suffix.trim()) {
      leading.push(normalizeText(suffix));
    }
    const end = Math.min(document.lineCount - 1, position.line + 200);
    for (let i = position.line + 1; i <= end && leading.length < 100; i += 1) {
      if (document.lineAt(i).text.trim()) {
        leading.push(normalizeText(document.lineAt(i).text));
      }
    }
    if (leading.length === 0) {
      return false;
    }

    // Now check if the last 1 line of the completion matches the first 1 line of the lookahead,
    // or the last 2 lines match the first 2 lines, and so on.
    const maxN = Math.min(trailing.length, leading.length);

    for (let n = maxN; n >= 1; n -= 1) {
      const tail = trailing.slice(-n);
      let match = true;
      for (let i = 0; i < n; i += 1) {
        if (tail[i] !== leading[i]) {
          match = false;
          break;
        }
      }
      if (match) {
        return true;
      }
    }
    return false;
  }
}
