import * as vscode from 'vscode'
import { LSPService } from '@/services/lsp-service';
import { AstService } from '@/services/ast-service';

export class CrossFileService implements vscode.Disposable {
    private readonly disposables: vscode.Disposable[] = []

    constructor(private readonly lspService: LSPService, private readonly astService: AstService) {
        this.registerListeners();
    }

    private registerListeners() {
        this.disposables.push(vscode.workspace.onDidSaveTextDocument(doc => {

        }))
    }

    dispose() {

    }
}