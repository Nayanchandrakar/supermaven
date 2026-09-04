import * as vscode from "vscode";

import { PrefixStage } from "@/lib/prefix-stage";
import { IntentTrackerService } from "@/services/intent-tracker-service";
import { LSPService } from "@/services/lsp-service";
import { ReplacementRegionStage } from "@/lib/replacement-region-stage";
import { SuffixStage } from "@/lib/suffix-stage";

export class ContextGatherer implements vscode.Disposable {
  private readonly disposables: vscode.Disposable[] = [];

  constructor(
    private readonly intentTrackerService: IntentTrackerService,
    private readonly prefixStage: PrefixStage,
    private readonly lspService: LSPService,
    private readonly replacementRegion: ReplacementRegionStage,
    private readonly suffixStage: SuffixStage
  ) { }

  async gatherContext(document: vscode.TextDocument, position: vscode.Position): Promise<string> {
    const replacementRegion = this.replacementRegion.compute(document, position)

    const prefix = await this.prefixStage.buildPrefix(document, position) ?? ""
    const suffix = this.suffixStage.buildSuffixAfterRegion(document, replacementRegion.range.end)

    const editHistory = this.intentTrackerService.serialize();

    return replacementRegion.text
  }

  dispose() {
    throw new Error("Dispose method not being implmented");
  }
}
