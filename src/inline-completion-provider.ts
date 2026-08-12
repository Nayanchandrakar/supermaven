import * as vscode from "vscode";

const demos = [
  {
    trigger: "// inline-demo",
    completion: "// inline completion accepted!"
  },
  {
    trigger: "const greeting =",
    completion: 'const greeting = "Hello from VS Code inline completions";'
  },
  {
    trigger: "function demo",
    completion: "function demo() {\n  return true;\n}"
  }
] as const;

export class DemoInlineCompletionProvider implements vscode.InlineCompletionItemProvider {
  provideInlineCompletionItems(
    document: vscode.TextDocument,
    position: vscode.Position,
    _context: vscode.InlineCompletionContext,
    token: vscode.CancellationToken
  ): vscode.InlineCompletionItem[] {
    if (token.isCancellationRequested) {
      return [];
    }

    // Only inspect the text before the cursor. This makes each example work
    // when the trigger is typed at the end of a line.
    const linePrefix = document.lineAt(position.line).text.slice(0, position.character);

    console.log(document.lineAt(position.line).text);

    return demos.flatMap(({ trigger, completion }) => {
      if (!linePrefix.endsWith(trigger)) {
        return [];
      }

      // Replacing the trigger (instead of inserting after it) prevents the
      // same completion from appearing again after it has been accepted.
      const triggerStart = position.translate(0, -trigger.length);
      const range = new vscode.Range(triggerStart, position);

      return [new vscode.InlineCompletionItem(completion, range)];
    });
  }
}
