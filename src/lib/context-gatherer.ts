import * as vscode from "vscode";

import type { PrefixStage } from "@/lib/prefix-stage";
import type { ReplacementRegionStage } from "@/lib/replacement-region-stage";
import type { SuffixStage } from "@/lib/suffix-stage";
import type { CrossFileService } from "@/services/cross-file-service";
import type { IntentTrackerService } from "@/services/intent-tracker-service";
import type { CompletionContext } from "@/types";

export class ContextGatherer implements vscode.Disposable {
  private readonly intentTrackerService: IntentTrackerService;
  private readonly prefixStage: PrefixStage;
  private readonly replacementRegion: ReplacementRegionStage;
  private readonly suffixStage: SuffixStage;
  private readonly crossFileService: CrossFileService;

  constructor(
    intentTrackerService: IntentTrackerService,
    prefixStage: PrefixStage,
    replacementRegion: ReplacementRegionStage,
    suffixStage: SuffixStage,
    crossFileService: CrossFileService
  ) {
    this.intentTrackerService = intentTrackerService;
    this.prefixStage = prefixStage;
    this.replacementRegion = replacementRegion;
    this.suffixStage = suffixStage;
    this.crossFileService = crossFileService;
  }

  async gatherContext(
    document: vscode.TextDocument,
    position: vscode.Position
  ): Promise<CompletionContext> {
    const replacementRegion = this.replacementRegion.compute(
      document,
      position
    );

    const prefix =
      (await this.prefixStage.buildPrefix(document, position)) ?? "";
    const suffix = this.suffixStage.buildSuffixAfterRegion(
      document,
      replacementRegion.range.end
    );

    const crossFileSymbols = await this.crossFileService.getRelevantSymbols(
      document,
      prefix
    );
    const editHistory = this.intentTrackerService.serialize();

    return {
      crossFileSymbols,
      cursorPosition: position,
      editHistory,
      filePath: vscode.workspace.asRelativePath(document.uri),
      languageId: document.languageId,
      prefix,
      replacementRegion,
      suffixAfterRegion: suffix,
    };
  }

  // oxlint-disable-next-line class-methods-use-this
  dispose() {
    // No resources to dispose - required by vscode.Disposable interface
  }
}
