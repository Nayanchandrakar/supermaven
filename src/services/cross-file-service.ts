import * as vscode from 'vscode'
import { LSPService } from '@/services/lsp-service';
import { AstService } from '@/services/ast-service';
import { SymbolIndex } from '@/utils/symbol-index';
import { IndexedSymbol } from '@/types';

export class CrossFileService implements vscode.Disposable {
    private readonly disposables: vscode.Disposable[] = []

    constructor(private readonly lspService: LSPService, private readonly symbolIndex: SymbolIndex, private readonly astService: AstService) {
        this.registerListeners();
    }

    async getRelevantSymbols(document: vscode.TextDocument, prefix: string): Promise<IndexedSymbol[]> {
        const allSymbols = this.symbolIndex.getAllSymbols()
    }

    private registerListeners() {
        this.disposables.push(
            vscode.workspace.onDidSaveTextDocument((doc) => {
                void this.symbolIndex.indexDocument(doc)
            }),
            vscode.workspace.onDidOpenTextDocument((doc) => {
                void this.symbolIndex.indexDocument(doc)
            })
        )
    }

    dispose() {
        this.disposables.forEach(d => d.dispose())
    }
}