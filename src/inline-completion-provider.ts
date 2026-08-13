import * as vscode from "vscode";

type CompletionText = string | vscode.SnippetString;

type Demo = {
  trigger: string;
  languages: readonly string[];
  completion?: CompletionText;
  buildCompletion?: (document: vscode.TextDocument, position: vscode.Position) => CompletionText;
  alternatives?: readonly CompletionText[];
  range: "trigger" | "insert" | "word";
  filterText?: string;
  delayMilliseconds?: number;
  showAcceptedCommand?: boolean;
};

const javascriptLanguages = ["javascript", "javascriptreact", "typescript", "typescriptreact"];

const demos: readonly Demo[] = [
  {
    trigger: "tab:hello",
    languages: ["*"],
    completion: "Hello from an inline completion!",
    range: "trigger"
  },
  {
    // Explicitly invoke inline suggestions after typing this to cycle through
    // all three results. Automatic requests show only the first result.
    trigger: "tab:choose",
    languages: ["*"],
    completion: "const answer = 42;",
    alternatives: ['const answer = "yes";', "const answer = true;"],
    range: "trigger"
  },
  {
    // With no range, VS Code replaces the word at the cursor automatically.
    // Try this in the middle of a longer identifier to see the difference.
    trigger: "demoWord",
    languages: ["*"],
    completion: "replacement",
    range: "word"
  },
  {
    // `filterText` is what VS Code uses when deciding whether an item should
    // be shown. It does not have to be identical to the inserted text.
    trigger: "tab:filter",
    languages: ["*"],
    completion: "A longer visible completion",
    filterText: "tab:filter (A longer visible completion)",
    range: "trigger"
  },
  {
    // This completion reads the previous line, like a model would use nearby
    // code as context instead of returning a fixed answer.
    trigger: "tab:context",
    languages: javascriptLanguages,
    buildCompletion: (document, position) => {
      const textBeforeCursor = document.getText(
        new vscode.Range(new vscode.Position(0, 0), position)
      );
      const variable = textBeforeCursor.match(/\b(?:const|let|var)\s+([\w$]+)\s*=/)?.[1] ?? "value";
      return new vscode.SnippetString(`console.log(${variable});`);
    },
    range: "trigger"
  },
  {
    // This is a suffix completion: keep `console.` and insert only the rest.
    trigger: "console.",
    languages: javascriptLanguages,
    completion: new vscode.SnippetString('log(${1:"hello"});'),
    range: "insert"
  },
  {
    trigger: "tab:fn",
    languages: javascriptLanguages,
    completion: new vscode.SnippetString("function ${1:name}(${2:parameter}) {\n\t$0\n}"),
    range: "trigger"
  },
  {
    trigger: "tab:forof",
    languages: javascriptLanguages,
    completion: new vscode.SnippetString("for (const ${1:item} of ${2:items}) {\n\t$0\n}"),
    range: "trigger"
  },
  {
    // A multi-line completion is useful for seeing how an LLM response can
    // fill several lines at once.
    trigger: "tab:try",
    languages: javascriptLanguages,
    completion: new vscode.SnippetString(
      "try {\n\t$0\n} catch (error) {\n\tconsole.error(error);\n}"
    ),
    range: "trigger"
  },
  {
    trigger: "tab:def",
    languages: ["python"],
    completion: new vscode.SnippetString("def ${1:name}(${2:parameter}):\n\t$0"),
    range: "trigger"
  },
  {
    trigger: "tab:main",
    languages: ["python"],
    completion: new vscode.SnippetString('if __name__ == "__main__":\n\t$0'),
    range: "trigger"
  },
  {
    trigger: "tab:json",
    languages: ["json", "jsonc"],
    completion: new vscode.SnippetString('{\n  "enabled": ${1:true},\n  "model": "${2:demo}"\n}'),
    range: "trigger"
  },
  {
    trigger: "tab:todo",
    languages: ["markdown"],
    completion: new vscode.SnippetString("- [ ] ${1:task}"),
    range: "trigger"
  },
  {
    // This intentionally waits to imitate a network/model request. Type more
    // text before it finishes and VS Code will cancel this request.
    trigger: "tab:slow",
    languages: ["*"],
    completion: "This completion came back from a fake model.",
    delayMilliseconds: 500,
    range: "trigger"
  },
  {
    trigger: "tab:accepted",
    languages: ["*"],
    completion: "The provider ran a command after acceptance.",
    showAcceptedCommand: true,
    range: "trigger"
  }
];

function supportsLanguage(demo: Demo, languageId: string): boolean {
  return demo.languages.includes("*") || demo.languages.includes(languageId);
}

function getReplacementRange(
  position: vscode.Position,
  trigger: string,
  rangeMode: Demo["range"]
): vscode.Range {
  if (rangeMode === "insert") {
    // An empty range means “insert at the cursor”.
    return new vscode.Range(position, position);
  }

  if (rangeMode === "word") {
    // Returning no range is also valid; this helper is only used when we need
    // to create an explicit range. The caller handles the default word range.
    return new vscode.Range(position, position);
  }

  // Replacing what the user typed prevents the same trigger from appearing
  // again after the completion has been accepted.
  return new vscode.Range(position.translate(0, -trigger.length), position);
}

function waitForCancellation(
  milliseconds: number,
  token: vscode.CancellationToken
): Promise<boolean> {
  if (token.isCancellationRequested) {
    return Promise.resolve(false);
  }

  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      cancellation.dispose();
      resolve(true);
    }, milliseconds);
    const cancellation = token.onCancellationRequested(() => {
      clearTimeout(timeout);
      cancellation.dispose();
      resolve(false);
    });
  });
}

export class DemoInlineCompletionProvider implements vscode.InlineCompletionItemProvider {
  async provideInlineCompletionItems(
    document: vscode.TextDocument,
    position: vscode.Position,
    context: vscode.InlineCompletionContext,
    token: vscode.CancellationToken
  ): Promise<vscode.InlineCompletionItem[]> {
    // Providers are called frequently. Exit before doing expensive work when
    // VS Code has already cancelled this request.
    if (token.isCancellationRequested || context.selectedCompletionInfo !== undefined) {
      return [];
    }

    const linePrefix = document.lineAt(position.line).text.slice(0, position.character);
    const isExplicitRequest = context.triggerKind === vscode.InlineCompletionTriggerKind.Invoke;

    const matchingDemos = demos.filter((demo) => {
      return supportsLanguage(demo, document.languageId) && linePrefix.endsWith(demo.trigger);
    });

    const requestsCompleted = await Promise.all(
      matchingDemos.map(async (demo) => {
        return (
          demo.delayMilliseconds === undefined ||
          (await waitForCancellation(demo.delayMilliseconds, token))
        );
      })
    );
    if (!requestsCompleted.every(Boolean) || token.isCancellationRequested) {
      return [];
    }

    const items: vscode.InlineCompletionItem[] = [];

    for (const demo of matchingDemos) {
      const completion = demo.buildCompletion?.(document, position) ?? demo.completion;
      if (completion === undefined) {
        continue;
      }

      const allCompletions = [completion, ...(demo.alternatives ?? [])];
      // Automatic requests should stay lightweight. An explicit request can
      // return multiple items, which lets the user cycle through alternatives.
      const completions = isExplicitRequest ? allCompletions : [completion];

      for (const completionText of completions) {
        const item =
          demo.range === "word"
            ? new vscode.InlineCompletionItem(completionText)
            : new vscode.InlineCompletionItem(
                completionText,
                getReplacementRange(position, demo.trigger, demo.range)
              );

        if (demo.filterText !== undefined) {
          item.filterText = demo.filterText;
        }

        if (demo.showAcceptedCommand) {
          item.command = {
            command: "cursor-tab.inlineCompletionAccepted",
            title: "Inline completion accepted",
            arguments: [demo.trigger]
          };
        }

        items.push(item);
      }
    }

    return items;
  }
}
