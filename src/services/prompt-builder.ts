import {
  DEFAULT_BUDGET,
  DEFAULT_PROMPT_OVERHEAD_TOKENS,
  SYSTEM_PROMPT,
} from "@/constants/system-prompt";
import type {
  ChatMessage,
  CompletionContext,
  FitToBudgetInput,
  FitToBudgetResult,
} from "@/types";

// oxlint-disable-next-line typescript/no-extraneous-class
export class PromptBuilder {
  static buildPrompt(context: CompletionContext): ChatMessage[] {
    const userContent = PromptBuilder.buildUserPrompt(context);

    return [
      { content: SYSTEM_PROMPT, role: "system" },
      { content: userContent, role: "user" },
    ];
  }

  static buildUserPrompt(context: CompletionContext): string {
    const importedSignatures = PromptBuilder.getImportedSignatures(context);
    const fitted = PromptBuilder.fitToBudget({
      editHistory: context.editHistory,
      importedSignatures,
      languageId: context.languageId,
      prefix: context.prefix,
      promptOverheadTokens: DEFAULT_PROMPT_OVERHEAD_TOKENS,
      replaceRegion: context.replacementRegion.text,
      suffix: context.suffixAfterRegion,
      systemPrompt: SYSTEM_PROMPT,
    });

    const parts: string[] = [];

    parts.push(
      `<file lang="${context.languageId}" path="${context.filePath}">`
    );
    if (fitted.importedSignatures) {
      parts.push("<types>", fitted.importedSignatures, "</types>");
    }

    if (fitted.editHistory) {
      parts.push("<recent_edits>", fitted.editHistory, "</recent_edits>");
    }

    parts.push(
      "<prefix>",
      `${fitted.prefix}<cursor />`,
      "</prefix>",
      "<replace_region>",
      fitted.replaceRegion,
      "</replace_region>",
      "<suffix>",
      fitted.suffix,
      "</suffix>",
      "</file>"
    );

    return parts.join("\n");
  }

  static estimateTokens(text: string): number {
    if (!text) {
      return 0;
    }
    return Math.ceil(text.length / 4);
  }

  private static tokensToChars(tokens: number): number {
    return Math.max(0, tokens) * 4;
  }

  static fitToBudget(parts: FitToBudgetInput): FitToBudgetResult {
    const editHistory = PromptBuilder.truncateToTokens(
      parts.editHistory,
      DEFAULT_BUDGET.editHistory
    );

    const importedSignatures = PromptBuilder.truncateToTokens(
      parts.importedSignatures.join("\n"),
      DEFAULT_BUDGET.importedSignatures
    );

    const currentFileCap = PromptBuilder.tokensToChars(
      DEFAULT_BUDGET.currentFile
    );
    let { prefix } = parts;
    const { replaceRegion } = parts;
    let { suffix } = parts;

    if (prefix.length + replaceRegion.length + suffix.length > currentFileCap) {
      const keep = Math.max(0, currentFileCap - replaceRegion.length);
      const prefixShare = Math.min(prefix.length, Math.ceil(keep * 0.9));
      const suffixShare = Math.min(suffix.length, keep - prefixShare);
      prefix = prefix.slice(prefix.length - prefixShare);
      suffix = suffix.slice(0, suffixShare);
    }

    return {
      editHistory,
      importedSignatures,
      prefix,
      replaceRegion,
      suffix,
    };
  }

  static truncateToTokens(text: string, maxTokens: number): string {
    const maxChars = PromptBuilder.tokensToChars(maxTokens);
    if (!text || text.length <= maxChars) {
      return text;
    }
    return text.slice(0, maxChars);
  }

  private static getImportedSignatures(context: CompletionContext): string[] {
    const symbols = context.crossFileSymbols;

    if (!symbols) {
      return [];
    }

    const result: string[] = [];

    for (const symbol of symbols) {
      if (symbol.signature) {
        result.push(symbol.signature);
      }
    }

    return result;
  }
}
