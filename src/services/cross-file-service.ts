import * as vscode from "vscode";

import type { IndexedSymbol } from "@/types";
import type { ReferenceExtractor } from "@/utils/reference-extractor";
import type { SignatureProvider } from "@/utils/signature-provider";
import type { SymbolIndex } from "@/utils/symbol-index";

export class CrossFileService implements vscode.Disposable {
  private readonly disposables: vscode.Disposable[] = [];
  private readonly symbolIndex: SymbolIndex;
  private readonly referenceExtractor: ReferenceExtractor;
  private readonly signatureProvider: SignatureProvider;

  constructor(
    symbolIndex: SymbolIndex,
    referenceExtractor: ReferenceExtractor,
    signatureProvider: SignatureProvider
  ) {
    this.symbolIndex = symbolIndex;
    this.referenceExtractor = referenceExtractor;
    this.signatureProvider = signatureProvider;
    this.registerListeners();
  }

  getRelevantSymbols(
    document: vscode.TextDocument,
    prefix: string
  ): Promise<IndexedSymbol[]> {
    const nearbyContext = this.referenceExtractor.extract(
      prefix,
      document.languageId
    );

    if (nearbyContext.referenceNames.size === 0) {
      return Promise.resolve([]);
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
      return Promise.resolve([]);
    }

    return Promise.resolve(referencedCandidates);
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
    for (const d of this.disposables) {
      d.dispose();
    }
    this.signatureProvider.clear();
    this.symbolIndex.clear();
  }
}
