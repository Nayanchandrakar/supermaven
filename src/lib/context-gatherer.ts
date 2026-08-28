import * as vscode from "vscode";
import { PrefixStage } from "@/lib/prefix-stage";
import { IntentTrackerService } from "@/services/intent-tracker-service";
import { LSPService } from "@/services/lsp-service";

export class ContextGatherer implements vscode.Disposable {
  private readonly disposables: vscode.Disposable[] = [];

  constructor(
    private readonly intentTrackerService: IntentTrackerService,
    private readonly prefixStage: PrefixStage,
    private readonly lspService: LSPService
  ) {}

  async gatherContext(document: vscode.TextDocument, position: vscode.Position): Promise<string> {
    const _editHistory = this.intentTrackerService.serialize();
    return (await this.prefixStage.buildPrefix(document, position)) ?? "";
  }

  dispose() {
    throw new Error("Dispose method not being implmented");
  }
}
