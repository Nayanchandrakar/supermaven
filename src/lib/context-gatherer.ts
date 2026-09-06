import * as vscode from "vscode";

import { PrefixStage } from "@/lib/prefix-stage";
import { ReplacementRegionStage } from "@/lib/replacement-region-stage";
import { SuffixStage } from "@/lib/suffix-stage";
import { CrossFileService } from "@/services/cross-file-service";
import { IntentTrackerService } from "@/services/intent-tracker-service";
import { CompletionContext } from "@/types";

export class ContextGatherer implements vscode.Disposable {
  constructor(
    private readonly intentTrackerService: IntentTrackerService,
    private readonly prefixStage: PrefixStage,
    private readonly replacementRegion: ReplacementRegionStage,
    private readonly suffixStage: SuffixStage,
    private readonly crossFileService: CrossFileService
  ) {}

  async gatherContext(
    document: vscode.TextDocument,
    position: vscode.Position
  ): Promise<CompletionContext> {
    const replacementRegion = this.replacementRegion.compute(document, position);

    const prefix = (await this.prefixStage.buildPrefix(document, position)) ?? "";
    const suffix = this.suffixStage.buildSuffixAfterRegion(document, replacementRegion.range.end);

    const crossFileSymbols = await this.crossFileService.getRelevantSymbols(document, prefix);
    const editHistory = this.intentTrackerService.serialize();

    return {
      prefix,
      replacementRegion,
      suffixAfterRegion: suffix,
      crossFileSymbols,
      cursorPosition: position,
      filePath: vscode.workspace.asRelativePath(document.uri),
      editHistory,
      languageId: document.languageId
    };
  }

  dispose() {
    throw new Error("Dispose method not being implmented");
  }
}
