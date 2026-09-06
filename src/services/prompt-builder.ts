import {
  DEFAULT_BUDGET,
  DEFAULT_PROMPT_OVERHEAD_TOKENS,
  SYSTEM_PROMPT
} from "@/constants/system-prompt";
import { ChatMessage, CompletionContext, FitToBudgetInput, FitToBudgetResult } from "@/types";

export class PromptBuilder {
  buildPrompt(context: CompletionContext): ChatMessage[] {
    const userContent = this.buildUserPrompt(context);

    return [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userContent }
    ];
  }

  private buildUserPrompt(context: CompletionContext): string {
    const importedSignatures = this.getImportedSignatures(context);
    const fitted = this.fitToBudget({
      systemPrompt: SYSTEM_PROMPT,
      prefix: context.prefix,
      replaceRegion: context.replacementRegion.text,
      suffix: context.suffixAfterRegion,
      importedSignatures,
      editHistory: context.editHistory,
      languageId: context.languageId,
      promptOverheadTokens: DEFAULT_PROMPT_OVERHEAD_TOKENS
    });

    const parts: string[] = [];

    parts.push(`<file lang="${context.languageId}" path="${context.filePath}">`);
    if (fitted.importedSignatures) {
      parts.push("<types>");
      parts.push(fitted.importedSignatures);
      parts.push("</types>");
    }

    if (fitted.editHistory) {
      parts.push("<recent_edits>");
      parts.push(fitted.editHistory);
      parts.push("</recent_edits>");
    }

    parts.push("<prefix>");
    parts.push(`${fitted.prefix}<cursor />`);
    parts.push("</prefix>");

    parts.push("<replace_region>");
    parts.push(fitted.replaceRegion);
    parts.push("</replace_region>");

    parts.push("<suffix>");
    parts.push(fitted.suffix);
    parts.push("</suffix>");

    parts.push(`</file>`);

    return parts.join("\n");
  }

  estimateTokens(text: string): number {
    if (!text) return 0;
    return Math.ceil(text.length / 4);
  }

  private tokensToChars(tokens: number): number {
    return Math.max(0, tokens) * 4;
  }

  private fitToBudget(parts: FitToBudgetInput): FitToBudgetResult {
    const editHistory = this.truncateToTokens(parts.editHistory, DEFAULT_BUDGET.editHistory);

    const importedSignatures = this.truncateToTokens(
      parts.importedSignatures.join("\n"),
      DEFAULT_BUDGET.importedSignatures
    );

    const currentFileCap = this.tokensToChars(DEFAULT_BUDGET.currentFile);
    let prefix = parts.prefix;
    const replaceRegion = parts.replaceRegion;
    let suffix = parts.suffix;

    if (prefix.length + replaceRegion.length + suffix.length > currentFileCap) {
      const keep = Math.max(0, currentFileCap - replaceRegion.length);
      const prefixShare = Math.min(prefix.length, Math.ceil(keep * 0.9));
      const suffixShare = Math.min(suffix.length, keep - prefixShare);
      prefix = prefix.slice(prefix.length - prefixShare);
      suffix = suffix.slice(0, suffixShare);
    }

    return {
      prefix,
      replaceRegion,
      suffix,
      importedSignatures,
      editHistory
    };
  }

  private truncateToTokens(text: string, maxTokens: number): string {
    const maxChars = this.tokensToChars(maxTokens);
    if (!text || text.length <= maxChars) return text;
    return text.slice(0, maxChars);
  }

  private getImportedSignatures(context: CompletionContext): string[] {
    const symbols = context.crossFileSymbols;

    if (!symbols) return [];

    const result: string[] = [];

    for (const symbol of symbols) {
      if (symbol.signature) {
        result.push(symbol.signature);
      }
    }

    return result;
  }
}
