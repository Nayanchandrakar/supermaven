import * as vscode from "vscode";

import type { IntentEntry, IntentType, PendingIntent } from "@/types";
import { generateHash } from "@/utils/generate-hash";

export class IntentTrackerService implements vscode.Disposable {
  private readonly disposables: vscode.Disposable[] = [];
  private lastDocumentVersion = new Map<string, number>();
  private buffer: IntentEntry[] = [];
  private pendingIntent: PendingIntent | null = null;
  private flushTimeout: NodeJS.Timeout | null = null;
  private idCounter = 0;

  constructor() {
    this.registerListeners();
  }

  private registerListeners() {
    this.disposables.push(
      vscode.workspace.onDidChangeTextDocument((event) => {
        this.handleDocumentChange(event);
      }),
      vscode.window.onDidChangeActiveTextEditor((event) => {
        this.handleActiveEditorChange(event);
      })
    );
  }

  computeHash(): string {
    const content = this.buffer
      .map((e) => `${e.filePath}:${e.timestamp}:${e.type}:${e.content}`)
      .join("|");
    return generateHash(content);
  }

  private handleDocumentChange({
    document,
    contentChanges,
  }: vscode.TextDocumentChangeEvent) {
    if (document.uri.scheme !== "file") {
      return;
    }

    const activeEditor = vscode.window.activeTextEditor;

    if (
      !activeEditor ||
      activeEditor.document.uri.toString() !== document.uri.toString()
    ) {
      return;
    }

    const docKey = document.uri.toString();
    const previousVersion = this.lastDocumentVersion.get(docKey);
    const currentVersion = document.version;

    this.lastDocumentVersion.set(docKey, currentVersion);

    if (
      previousVersion !== undefined &&
      Math.abs(currentVersion - previousVersion) > 1
    ) {
      if (
        this.pendingIntent &&
        this.pendingIntent.filePath === document.uri.fsPath
      ) {
        this.pendingIntent = null;
        this.clearFlushTimeout();
      }
      return;
    }

    for (const change of contentChanges) {
      this.processChange(document, change);
    }
  }

  private processChange(
    document: vscode.TextDocument,
    change: vscode.TextDocumentContentChangeEvent
  ) {
    const now = Date.now();
    const { line } = change.range.start;
    const filePath = document.uri.fsPath;
    const isPaste = change.text.length > 50;
    const currentLineContent =
      line < document.lineCount ? document.lineAt(line).text : "";

    const canContinuePending =
      this.pendingIntent &&
      this.pendingIntent.filePath === filePath &&
      now - this.pendingIntent?.lastActivityTime < 1500;

    if (!canContinuePending) {
      this.finalizeIntent();
    }

    if (!this.pendingIntent) {
      this.pendingIntent = {
        affectedLines: new Set(),
        currentContent: new Map(),
        filePath,
        lastActivityTime: now,
        originalContent: new Map(),
        startTime: now,
        type: isPaste ? "pasted" : "added",
      };
    }

    this.captureOriginalLineContent(change, line, currentLineContent);

    this.pendingIntent?.currentContent.set(line, currentLineContent);
    this.pendingIntent?.affectedLines.add(line);
    this.pendingIntent.lastActivityTime = now;

    if (isPaste) {
      this.pendingIntent.type = "pasted";
    }

    this.pendingIntent.type = IntentTrackerService.classifyIntentType(
      this.pendingIntent
    );

    this.scheduleFlush();
  }

  private scheduleFlush() {
    this.clearFlushTimeout();
    this.flushTimeout = setTimeout(() => {
      this.finalizeIntent();
    }, 1500);
  }

  private clearFlushTimeout() {
    if (this.flushTimeout) {
      clearTimeout(this.flushTimeout);
      this.flushTimeout = null;
    }
  }

  private static classifyIntentType(pendingIntent: PendingIntent): IntentType {
    if (pendingIntent.type === "pasted") {
      return "pasted";
    }

    let hasAddition = false;
    let hasEdit = false;

    for (const line of pendingIntent.affectedLines) {
      const original = pendingIntent.originalContent.get(line) ?? "";

      const current = pendingIntent.currentContent.get(line) ?? "";

      if (original.trim().length === 0 && current.trim().length > 0) {
        hasAddition = true;
      } else if (original.trim() !== current.trim()) {
        hasEdit = true;
      }
    }

    if (hasEdit) {
      return "edited";
    }
    if (hasAddition) {
      return "added";
    }

    return "edited";
  }

  private captureOriginalLineContent(
    change: vscode.TextDocumentContentChangeEvent,
    line: number,
    currentLineContent: string
  ) {
    if (this.pendingIntent?.originalContent.has(line)) {
      return;
    }

    let originalLineContent = currentLineContent;

    if (change.rangeLength === 0 && change.text.length > 0) {
      const startChar = change.range.start.character;
      originalLineContent =
        currentLineContent.slice(0, startChar) +
        currentLineContent.slice(startChar + change.text.length);
    }

    this.pendingIntent?.originalContent.set(line, originalLineContent);
  }

  private finalizeIntent() {
    this.clearFlushTimeout();

    if (!this.pendingIntent) {
      return;
    }

    const pending = this.pendingIntent;
    this.pendingIntent = null;

    let hasChange = false;

    for (const line of pending.affectedLines) {
      const original = pending.originalContent.get(line) ?? "";
      const current = pending.currentContent.get(line) ?? "";

      if (original !== current) {
        hasChange = true;
        break;
      }
    }

    if (!hasChange) {
      return;
    }

    const lines = [...pending.affectedLines].toSorted((a, b) => a - b);

    const [firstLine, ...rest] = lines;
    const lastLine = rest.at(-1) ?? firstLine;

    if (firstLine === undefined || lastLine === undefined) {
      return;
    }

    const startLine = firstLine + 1;
    const endLine = lastLine + 1;
    const contentLines: string[] = [];

    for (const line of lines) {
      const content = pending.currentContent.get(line);
      if (content !== undefined) {
        contentLines.push(content);
      }
    }

    const content = contentLines.join("\n");

    const entry: IntentEntry = {
      content,
      filePath: pending.filePath,
      id: `intent_${this.idCounter}`,
      lineRange: { end: endLine, start: startLine },
      timestamp: pending.lastActivityTime,
      type: pending.type,
    };
    this.idCounter += 1;

    const merged = this.maybeMergeWithDifferent(entry);

    if (merged) {
      const idx = this.buffer.findIndex((e) => e.id === merged.id);

      if (idx === -1) {
        this.buffer.push(entry);

        while (this.buffer.length > 35) {
          this.buffer.shift();
        }
      } else {
        this.buffer[idx] = merged;
      }
    }
  }

  private maybeMergeWithDifferent(entry: IntentEntry): IntentEntry | null {
    const now = Date.now();

    for (let i = this.buffer.length - 1; i >= 0; i -= 1) {
      const existing = this.buffer[i];
      if (!existing) {
        continue;
      }
      if (now - existing.timestamp > 5000) {
        break;
      }

      if (existing.filePath !== entry.filePath) {
        continue;
      }

      const overlap =
        existing.lineRange.start <= entry.lineRange.end &&
        entry.lineRange.start <= existing.lineRange.end;

      const adjacent =
        Math.abs(existing.lineRange.end - entry.lineRange.start) <= 1 ||
        Math.abs(entry.lineRange.end - existing.lineRange.start) <= 1;

      if (adjacent || overlap) {
        let mergedType: IntentType;
        if (existing.type === "edited" || entry.type === "edited") {
          mergedType = "edited";
        } else if (existing.type === "pasted" || entry.type === "pasted") {
          mergedType = "pasted";
        } else {
          mergedType = entry.type;
        }

        const mergedRange = {
          end: Math.max(existing.lineRange.end, entry.lineRange.end),
          start: Math.min(existing.lineRange.start, entry.lineRange.start),
        };

        return {
          content: entry.content,
          filePath: entry.filePath,
          id: existing.id,
          lineRange: mergedRange,
          timestamp: entry.timestamp,
          type: mergedType,
        };
      }
    }

    return null;
  }

  private handleActiveEditorChange(editor: vscode.TextEditor | undefined) {
    if (!this.pendingIntent) {
      return;
    }

    if (!editor || editor.document.uri.fsPath !== this.pendingIntent.filePath) {
      this.finalizeIntent();
    }
  }

  private static getRelativePath(filePath: string): string {
    const { workspaceFolders } = vscode.workspace;

    if (!workspaceFolders || workspaceFolders.length === 0) {
      return filePath.split("/").pop() || filePath;
    }

    for (const folder of workspaceFolders) {
      if (filePath.startsWith(folder.uri.fsPath)) {
        return filePath.slice(folder.uri.fsPath.length + 1);
      }
    }

    return filePath.split("/").pop() || filePath;
  }

  serialize(): string {
    this.finalizeIntent();

    if (this.buffer.length === 0) {
      return "";
    }

    const entries = this.buffer.slice(-35);
    const lines: string[] = [];

    for (let i = 0; i < entries.length; i += 1) {
      const entry = entries[i];
      if (!entry) {
        continue;
      }
      const relativePath = IntentTrackerService.getRelativePath(entry.filePath);
      const lineRange =
        entry.lineRange.start === entry.lineRange.end
          ? `${entry.lineRange.start}`
          : `${entry.lineRange.start}-${entry.lineRange.end}`;

      lines.push(
        `${i + 1}. [${entry.type}] ${relativePath}: ${lineRange} -> "${entry.content}"`
      );
    }

    return lines.join("\n");
  }

  recordAcceptedSuggestion(filePath: string, line: number, content: string) {
    this.finalizeIntent();
    this.idCounter += 1;
    const entry: IntentEntry = {
      content,
      filePath,
      id: `intent_${this.idCounter}`,
      lineRange: { end: line, start: line },
      timestamp: Date.now(),
      type: "accepted",
    };

    this.buffer.push(entry);

    while (this.buffer.length > 35) {
      this.buffer.shift();
    }
  }

  recordRejectedSuggestion(filePath: string, line: number, content: string) {
    this.idCounter += 1;
    const entry: IntentEntry = {
      content,
      filePath,
      id: `intent_${this.idCounter}`,
      lineRange: { end: line, start: line },
      timestamp: Date.now(),
      type: "rejected",
    };

    this.buffer.push(entry);

    while (this.buffer.length > 35) {
      this.buffer.shift();
    }
  }

  dispose() {
    this.finalizeIntent();
    for (const d of this.disposables) {
      d.dispose();
    }
    this.clearFlushTimeout();
  }
}
