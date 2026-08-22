import * as vscode from "vscode";
import { LSPService } from "@/services/lsp-service";
import { EnclosingScopes } from "@/types";

export class LocaleDependencyResolver {
  constructor(private readonly lspService: LSPService) {}

  async collectSameFileDependencies(
    document: vscode.TextDocument,
    scopes: EnclosingScopes,
    usedIdentifiers: Set<string>,
    position: vscode.Position
  ): Promise<string> {}
}
