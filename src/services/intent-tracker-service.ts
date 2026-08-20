import { IntentType, PendingIntent } from "@/types";
import * as vscode from "vscode";

export class IntentTrackerService implements vscode.Disposable {
  private readonly disposables: vscode.Disposable[] = [];
  private lastDocumentVersion: Map<string, number> = new Map();
  private pendingIntent: PendingIntent | null = null;
  private flushTimeout: NodeJS.Timeout | null = null;

  constructor() {
    this.registerListeners();
  }

  private registerListeners() {
    this.disposables.push(
      vscode.workspace.onDidChangeTextDocument((event) => {
        this.handleDocumentChange(event);
      })
    );

    this.disposables.push(
      vscode.window.onDidChangeActiveTextEditor((event) => {
        this.handleActiveEditorChange(event);
      })
    );
  }

  private handleDocumentChange({ document, contentChanges }: vscode.TextDocumentChangeEvent) {
    if (document.uri.scheme !== "file") return;

    const activeEditor = vscode.window.activeTextEditor

    if (!activeEditor || activeEditor.document.uri.toString() !== document.uri.toString()) return;

    const docKey = document.uri.toString();
    const previousVersion = this.lastDocumentVersion.get(docKey)
    const currentVersion = document.version;

    this.lastDocumentVersion.set(docKey, currentVersion)

    if (previousVersion !== undefined && Math.abs(currentVersion - previousVersion) > 1) {
      if (this.pendingIntent && this.pendingIntent.filePath === document.uri.fsPath) {
        this.pendingIntent = null;
      }
      return;
    }

    for (const change of contentChanges) {
      this.processChange(document, change)
    }
  }

  private processChange(document: vscode.TextDocument, change: vscode.TextDocumentContentChangeEvent) {
    const now = Date.now()
    const line = change.range.start.line;
    const filePath = document.uri.fsPath
    const isPaste = change.text.length > 50
    const currentLineContent = line < document.lineCount ? document.lineAt(line).text : ""

    const canContinuePending = this.pendingIntent && this.pendingIntent.filePath === filePath && (now - this.pendingIntent?.lastActivityTime < 1500)

    if (!canContinuePending) {
      this.finalizeIntent()
    }

    if (!this.pendingIntent) {
      this.pendingIntent = {
        filePath,
        type: isPaste ? "pasted" : "added",
        startTime: now,
        lastActivityTime: now,
        originalContent: new Map(),
        currentContent: new Map(),
        affectedLines: new Set()
      }
    }

    this.captureOriginalLineContent(change, line, currentLineContent)

    this.pendingIntent?.currentContent.set(line, currentLineContent)
    this.pendingIntent?.affectedLines.add(line)
    this.pendingIntent.lastActivityTime = now

    if (isPaste) {
      this.pendingIntent.type = "pasted"
    }

    this.pendingIntent.type = this.classifyIntentType(this.pendingIntent)

  }

  private classifyIntentType(pendingIntent: PendingIntent): IntentType {
    if (pendingIntent.type === "pasted") return "pasted"

    let hasAddition: boolean = false;
    let hasEdit: boolean = false;

    for (const line of pendingIntent.affectedLines) {
      const original = pendingIntent.originalContent.get(line) ?? ""

      const current = pendingIntent.currentContent.get(line) ?? ""

      if (origin.trim().length === 0 && current.trim().length > 0) {
        hasAddition = true;

      } else if (original.trim() !== current.trim()) {
        hasEdit = true;
      }
    }


    if (hasEdit) return "edited";
    if (hasAddition) return 'added'

    return 'edited'
  }

  private captureOriginalLineContent(change: vscode.TextDocumentContentChangeEvent, line: number, currentLineContent: string) {
    if (this.pendingIntent?.originalContent.has(line)) return;

    let originalLineContent = currentLineContent

    if (change.rangeLength === 0 && change.text.length > 0) {
      const startChar = change.range.start.character
      originalLineContent = currentLineContent.slice(0, startChar) + currentLineContent.slice(startChar + change.text.length)
    }

    this.pendingIntent?.originalContent.set(line, originalLineContent)
  }

  private finalizeIntent() {

  }


  private handleActiveEditorChange(_event: vscode.TextEditor | undefined) {
  }

  dispose() {
    throw new Error("Method not implemented.");
  }
}
