import * as vscode from "vscode";

type CompletionText = string | vscode.SnippetString;

type Demo = {
  trigger: string;
  languages: readonly string[];
  completion: CompletionText;
  alternatives?: readonly CompletionText[];
  replaceTrigger: boolean;
};

const javascriptLanguages = ["javascript", "javascriptreact", "typescript", "typescriptreact"];

const demos: readonly Demo[] = [
  {
    trigger: "tab:hello",
    languages: ["*"],
    completion: "Hello from an inline completion!",
    replaceTrigger: true
  },
  {
    // Explicitly invoke inline suggestions after typing this to cycle through
    // all three results. Automatic requests show only the first result.
    trigger: "tab:choose",
    languages: ["*"],
    completion: "const answer = 42;",
    alternatives: ['const answer = "yes";', "const answer = true;"],
    replaceTrigger: true
  },
  {
    // This is a suffix completion: keep `console.` and insert only the rest.
    trigger: "console.",
    languages: javascriptLanguages,
    completion: new vscode.SnippetString('log(${1:"hello"});'),
    replaceTrigger: false
  },
  {
    trigger: "tab:fn",
    languages: javascriptLanguages,
    completion: new vscode.SnippetString("function ${1:name}(${2:parameter}) {\n\t$0\n}"),
    replaceTrigger: true
  },
  {
    trigger: "tab:forof",
    languages: javascriptLanguages,
    completion: new vscode.SnippetString("for (const ${1:item} of ${2:items}) {\n\t$0\n}"),
    replaceTrigger: true
  },
  {
    // A multi-line completion is useful for seeing how an LLM response can
    // fill several lines at once.
    trigger: "tab:try",
    languages: javascriptLanguages,
    completion: new vscode.SnippetString(
      "try {\n\t$0\n} catch (error) {\n\tconsole.error(error);\n}"
    ),
    replaceTrigger: true
  },
  {
    trigger: "tab:def",
    languages: ["python"],
    completion: new vscode.SnippetString("def ${1:name}(${2:parameter}):\n\t$0"),
    replaceTrigger: true
  },
  {
    trigger: "tab:main",
    languages: ["python"],
    completion: new vscode.SnippetString('if __name__ == "__main__":\n\t$0'),
    replaceTrigger: true
  },
  {
    trigger: "tab:json",
    languages: ["json", "jsonc"],
    completion: new vscode.SnippetString('{\n  "enabled": ${1:true},\n  "model": "${2:demo}"\n}'),
    replaceTrigger: true
  },
  {
    trigger: "tab:todo",
    languages: ["markdown"],
    completion: new vscode.SnippetString("- [ ] ${1:task}"),
    replaceTrigger: true
  }
];

function supportsLanguage(demo: Demo, languageId: string): boolean {
  return demo.languages.includes("*") || demo.languages.includes(languageId);
}

function getReplacementRange(
  position: vscode.Position,
  trigger: string,
  replaceTrigger: boolean
): vscode.Range {
  if (!replaceTrigger) {
    // An empty range means “insert at the cursor”.
    return new vscode.Range(position, position);
  }

  // Replacing what the user typed prevents the same trigger from appearing
  // again after the completion has been accepted.
  return new vscode.Range(position.translate(0, -trigger.length), position);
}

export class DemoInlineCompletionProvider implements vscode.InlineCompletionItemProvider {
  provideInlineCompletionItems(
    document: vscode.TextDocument,
    position: vscode.Position,
    context: vscode.InlineCompletionContext,
    token: vscode.CancellationToken
  ): vscode.InlineCompletionItem[] {
    // Providers are called frequently. Exit before doing expensive work when
    // VS Code has already cancelled this request.
    if (token.isCancellationRequested || context.selectedCompletionInfo !== undefined) {
      return [];
    }

    const linePrefix = document.lineAt(position.line).text.slice(0, position.character);
    const isExplicitRequest = context.triggerKind === vscode.InlineCompletionTriggerKind.Invoke;

    return demos.flatMap((demo) => {
      if (!supportsLanguage(demo, document.languageId) || !linePrefix.endsWith(demo.trigger)) {
        return [];
      }

      const allCompletions = [demo.completion, ...(demo.alternatives ?? [])];
      // Automatic requests should stay lightweight. An explicit request can
      // return multiple items, which lets the user cycle through alternatives.
      const completions = isExplicitRequest ? allCompletions : [demo.completion];
      const range = getReplacementRange(position, demo.trigger, demo.replaceTrigger);

      return completions.map((completion) => new vscode.InlineCompletionItem(completion, range));
    });
  }
}
