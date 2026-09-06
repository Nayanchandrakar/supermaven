import * as vscode from "vscode";
import { AstService } from "@/services/ast-service";
import { LSPService } from "@/services/lsp-service";
import { IndexedSymbol } from "@/types";
import { ReferenceExtractor } from "@/utils/reference-extractor";
import { SignatureProvider } from "@/utils/signature-provider";
import { SymbolIndex } from "@/utils/symbol-index";

export class CrossFileService implements vscode.Disposable {
  private readonly disposables: vscode.Disposable[] = [];

  constructor(
    private readonly lspService: LSPService,
    private readonly symbolIndex: SymbolIndex,
    private readonly astService: AstService,
    private readonly referenceExtractor: ReferenceExtractor,
    private readonly signatureProvider: SignatureProvider
  ) {
    this.registerListeners();
  }

  async getRelevantSymbols(
    document: vscode.TextDocument,
    prefix: string
  ): Promise<IndexedSymbol[]> {
    const nearbyContext = this.referenceExtractor.extract(prefix, document.languageId);

    if (nearbyContext.referenceNames.size === 0) {
      return [];
    }

    const allSymbols = this.symbolIndex.getAllSymbols();
    const candidateSymbols = allSymbols.filter(
      (symbol) =>
        symbol.uri !== document.uri.toString() &&
        !nearbyContext.declaredIdentifiers.has(symbol.name)
    );

    const referencedCandidates = candidateSymbols.filter(
      (symbol) =>
        nearbyContext.referenceNames.has(symbol.name) &&
        symbol.kind !== vscode.SymbolKind.Method &&
        symbol.kind !== vscode.SymbolKind.Constructor
    );

    if (referencedCandidates.length === 0) {
      return [];
    }
  }

  private registerListeners() {
    this.disposables.push(
      vscode.workspace.onDidSaveTextDocument((doc) => {
        void this.symbolIndex.indexDocument(doc);
      }),
      vscode.workspace.onDidOpenTextDocument((doc) => {
        void this.symbolIndex.indexDocument(doc);
      })
    );
  }

  dispose() {
    this.disposables.forEach((d) => d.dispose());
    this.signatureProvider.clear();
    this.symbolIndex.clear();
  }
}
