# Inline completion lab

Launch the extension with `F5`, open an untitled file or a file in one of the
supported languages, and type a trigger at the end of a line. The suggestion
appears as faded “ghost text”; press `Tab` to accept it.

## Examples

| Language              | Type                    | What it demonstrates                                            |
| --------------------- | ----------------------- | --------------------------------------------------------------- |
| Any                   | `tab:hello`             | Replace the text that triggered the suggestion                  |
| Any                   | `tab:choose`            | Multiple results when inline suggestions are explicitly invoked |
| Any                   | `demoWord`              | VS Code's default word replacement range                        |
| Any                   | `tab:filter`            | `filterText`, which controls whether an item is shown           |
| Any                   | `tab:slow`              | An asynchronous request that can be cancelled                   |
| Any                   | `tab:accepted`          | A command that runs after the user accepts the item             |
| JavaScript/TypeScript | `console.`              | Insert only a suffix, keeping the existing prefix               |
| JavaScript/TypeScript | `tab:context`           | Build a completion from text already in the document            |
| JavaScript/TypeScript | `tab:fn`                | Snippet placeholders and tab stops                              |
| JavaScript/TypeScript | `tab:forof`             | A multi-line snippet                                            |
| JavaScript/TypeScript | `tab:try`               | A larger multi-line completion                                  |
| Python                | `tab:def` or `tab:main` | Language-aware suggestions                                      |
| JSON/JSONC            | `tab:json`              | JSON completion with placeholders                               |
| Markdown              | `tab:todo`              | A language-specific list item                                   |

For `tab:choose`, use the command palette and run **Trigger Inline
Suggestions** after typing the trigger. The explicit request returns all three
answers so you can cycle through them.

For `tab:context`, put something like `const user = getUser();` on the line
above, then type `tab:context` on the next line. The provider reads the
document prefix and produces `console.log(user);`. For `tab:slow`, type more
text while the half-second request is pending; the cancellation token stops
the old request.

## The provider flow

`registerInlineCompletionItemProvider` connects a document selector to a
provider. VS Code then repeatedly calls `provideInlineCompletionItems` with:

1. `document`: the complete document and its `languageId`.
2. `position`: where the cursor is.
3. `context`: why the request happened and whether another completion is selected.
4. `token`: a cancellation signal for work that is no longer needed.

The provider returns `InlineCompletionItem` objects. Each item has text and a
`Range`; the range is replaced when the user accepts the suggestion. A
`SnippetString` adds placeholders such as `${1:name}` and the final cursor
position `$0`.

There are three range behaviors in the source. An explicit range can replace
the trigger, an empty range can insert a suffix, and omitting the range lets
VS Code replace the word at the cursor. An item can also provide `filterText`
and a `command`; the command runs only after the user accepts that item.

## Turning this into Cursor-like completion

The demo uses local rules so the behavior is predictable. A production-style
provider generally follows this shape:

```ts
async provideInlineCompletionItems(document, position, context, token) {
  const prefix = document.getText(new vscode.Range(new vscode.Position(0, 0), position));
  const suffix = document.getText(new vscode.Range(position, document.positionAt(document.getText().length)));

  // Send a bounded amount of context to a completion service.
  const result = await getCompletionFromModel({ prefix, suffix }, token);

  if (token.isCancellationRequested) return [];
  return [new vscode.InlineCompletionItem(result.text, result.range)];
}
```

The demo's `tab:slow` example shows the important async rule: check the
cancellation token after the model/network request and discard stale results.

The important production concerns are keeping requests fast, cancelling stale
requests while the user keeps typing, caching recent prefixes, limiting the
amount of context sent to a model, and returning a precise replacement range.
