export const JS_TS_LANGUAGES = [
  "typescript",
  "typescriptreact",
  "javascript",
  "javascriptreact",
] as const;

export type JsTsLanguageId = (typeof JS_TS_LANGUAGES)[number];

// SAFETY: JS_TS_LANGUAGES is declared with `as const`, so its type is a tuple of literals.
// Casting to readonly string[] is safe for the `.includes()` check.
export const isJavaScriptOrTypeScript = (languageId: string): boolean =>
  (JS_TS_LANGUAGES as readonly string[]).includes(languageId);

export const JS_KEYWORDS = new Set([
  "break",
  "case",
  "catch",
  "continue",
  "debugger",
  "default",
  "delete",
  "do",
  "else",
  "false",
  "finally",
  "for",
  "function",
  "if",
  "in",
  "instanceof",
  "new",
  "null",
  "return",
  "switch",
  "this",
  "throw",
  "true",
  "try",
  "typeof",
  "var",
  "void",
  "while",
  "with",
  "class",
  "const",
  "enum",
  "export",
  "extends",
  "import",
  "super",
  "implements",
  "interface",
  "let",
  "package",
  "private",
  "protected",
  "public",
  "static",
  "yield",
  "async",
  "await",
  "of",
  "get",
  "set",
]);

export const PYTHON_KEYWORDS = new Set([
  "False",
  "None",
  "True",
  "and",
  "as",
  "assert",
  "async",
  "await",
  "break",
  "class",
  "continue",
  "def",
  "del",
  "elif",
  "else",
  "except",
  "finally",
  "for",
  "from",
  "global",
  "if",
  "import",
  "in",
  "is",
  "lambda",
  "nonlocal",
  "not",
  "or",
  "pass",
  "raise",
  "return",
  "try",
  "while",
  "with",
  "yield",
]);

export const RUST_KEYWORDS = new Set([
  "as",
  "async",
  "await",
  "break",
  "const",
  "continue",
  "crate",
  "dyn",
  "else",
  "enum",
  "extern",
  "false",
  "fn",
  "for",
  "if",
  "impl",
  "in",
  "let",
  "loop",
  "match",
  "mod",
  "move",
  "mut",
  "pub",
  "ref",
  "return",
  "self",
  "Self",
  "static",
  "struct",
  "super",
  "trait",
  "true",
  "type",
  "unsafe",
  "use",
  "where",
  "while",
  // Reserved for future use
  "abstract",
  "become",
  "box",
  "do",
  "final",
  "macro",
  "override",
  "priv",
  "typeof",
  "unsized",
  "virtual",
  "yield",
]);

export const GO_KEYWORDS = new Set([
  "break",
  "case",
  "chan",
  "const",
  "continue",
  "default",
  "defer",
  "else",
  "fallthrough",
  "for",
  "func",
  "go",
  "goto",
  "if",
  "import",
  "interface",
  "map",
  "package",
  "range",
  "return",
  "select",
  "struct",
  "switch",
  "type",
  "var",
  // Built-in types and functions (treated as keywords)
  "bool",
  "byte",
  "complex64",
  "complex128",
  "error",
  "float32",
  "float64",
  "int",
  "int8",
  "int16",
  "int32",
  "int64",
  "rune",
  "string",
  "uint",
  "uint8",
  "uint16",
  "uint32",
  "uint64",
  "uintptr",
  "true",
  "false",
  "nil",
  "iota",
  "append",
  "cap",
  "close",
  "complex",
  "copy",
  "delete",
  "imag",
  "len",
  "make",
  "new",
  "panic",
  "print",
  "println",
  "real",
  "recover",
]);

export const JAVA_KEYWORDS = new Set([
  "abstract",
  "assert",
  "boolean",
  "break",
  "byte",
  "case",
  "catch",
  "char",
  "class",
  "const",
  "continue",
  "default",
  "do",
  "double",
  "else",
  "enum",
  "extends",
  "final",
  "finally",
  "float",
  "for",
  "goto",
  "if",
  "implements",
  "import",
  "instanceof",
  "int",
  "interface",
  "long",
  "native",
  "new",
  "package",
  "private",
  "protected",
  "public",
  "return",
  "short",
  "static",
  "strictfp",
  "super",
  "switch",
  "synchronized",
  "this",
  "throw",
  "throws",
  "transient",
  "try",
  "void",
  "volatile",
  "while",
  // Literals
  "true",
  "false",
  "null",
  // Java 9+ module keywords
  "exports",
  "module",
  "opens",
  "provides",
  "requires",
  "to",
  "uses",
  "with",
  // Java 10+ var
  "var",
  // Java 14+ record, sealed, permits
  "record",
  "sealed",
  "permits",
  "non-sealed",
]);

export const C_KEYWORDS = new Set([
  "auto",
  "break",
  "case",
  "char",
  "const",
  "continue",
  "default",
  "do",
  "double",
  "else",
  "enum",
  "extern",
  "float",
  "for",
  "goto",
  "if",
  "inline",
  "int",
  "long",
  "register",
  "restrict",
  "return",
  "short",
  "signed",
  "sizeof",
  "static",
  "struct",
  "switch",
  "typedef",
  "union",
  "unsigned",
  "void",
  "volatile",
  "while",
  // C99
  "_Bool",
  "_Complex",
  "_Imaginary",
  // C11
  "_Alignas",
  "_Alignof",
  "_Atomic",
  "_Generic",
  "_Noreturn",
  "_Static_assert",
  "_Thread_local",
  // Common macros treated as keywords
  "NULL",
  "true",
  "false",
]);

export const CPP_KEYWORDS = new Set([
  // C keywords
  "auto",
  "break",
  "case",
  "char",
  "const",
  "continue",
  "default",
  "do",
  "double",
  "else",
  "enum",
  "extern",
  "float",
  "for",
  "goto",
  "if",
  "inline",
  "int",
  "long",
  "register",
  "return",
  "short",
  "signed",
  "sizeof",
  "static",
  "struct",
  "switch",
  "typedef",
  "union",
  "unsigned",
  "void",
  "volatile",
  "while",
  // C++ additions
  "alignas",
  "alignof",
  "and",
  "and_eq",
  "asm",
  "bitand",
  "bitor",
  "bool",
  "catch",
  "char8_t",
  "char16_t",
  "char32_t",
  "class",
  "compl",
  "concept",
  "const_cast",
  "consteval",
  "constexpr",
  "constinit",
  "co_await",
  "co_return",
  "co_yield",
  "decltype",
  "delete",
  "dynamic_cast",
  "explicit",
  "export",
  "false",
  "friend",
  "mutable",
  "namespace",
  "new",
  "noexcept",
  "not",
  "not_eq",
  "nullptr",
  "operator",
  "or",
  "or_eq",
  "private",
  "protected",
  "public",
  "reinterpret_cast",
  "requires",
  "static_assert",
  "static_cast",
  "template",
  "this",
  "thread_local",
  "throw",
  "true",
  "try",
  "typeid",
  "typename",
  "using",
  "virtual",
  "wchar_t",
  "xor",
  "xor_eq",
  // Common macros
  "NULL",
]);

export const isKeyword = (word: string, languageId: string): boolean => {
  if (isJavaScriptOrTypeScript(languageId)) {
    return JS_KEYWORDS.has(word);
  }

  if (languageId === "python") {
    return PYTHON_KEYWORDS.has(word);
  }

  if (languageId === "rust") {
    return RUST_KEYWORDS.has(word);
  }

  if (languageId === "go") {
    return GO_KEYWORDS.has(word);
  }

  if (languageId === "java") {
    return JAVA_KEYWORDS.has(word);
  }

  if (languageId === "c") {
    return C_KEYWORDS.has(word);
  }

  if (languageId === "cpp") {
    return CPP_KEYWORDS.has(word);
  }

  return false;
};

// A-Z, a-z, _
const isIdentifierStart = (ch: number): boolean =>
  (ch >= 65 && ch <= 90) || (ch >= 97 && ch <= 122) || ch === 95;

const isIdentifierPart = (ch: number): boolean =>
  isIdentifierStart(ch) || (ch >= 48 && ch <= 57);

export const extractIdentifiers = (
  text: string,
  languageId: string
): Set<string> => {
  const identifiers = new Set<string>();

  let i = 0;
  const len = text.length;

  while (i < len) {
    const ch = text.codePointAt(i);

    if (ch !== undefined && isIdentifierStart(ch)) {
      const start = i;
      i += 1;
      while (i < len && isIdentifierPart(text.codePointAt(i) ?? 0)) {
        i += 1;
      }
      const identifier = text.slice(start, i);

      if (!isKeyword(identifier, languageId)) {
        identifiers.add(identifier);
      }
    } else {
      i += 1;
    }
  }

  return identifiers;
};

export const getTruncationMarker = (
  languageId: string,
  skippedLines: number
): string => {
  const message = `... ${skippedLines} lines truncated ...`;
  if (languageId === "python") {
    return `# ${message}`;
  }
  if (
    isJavaScriptOrTypeScript(languageId) ||
    ["rust", "go", "java", "cpp", "c"].includes(languageId)
  ) {
    return `/* ${message} */`;
  }
  return `// ${message}`;
};

export const normalizeText = (text: string): string =>
  text.replaceAll(/\s+/gu, " ").trim().toLowerCase();

/**
 * Compute similarity between two strings (Levenshtein-based). Returns a value between 0 (completely
 * different) and 1 (identical).
 */
/**
 * Compute Levenshtein distance between two strings. Returns the minimum number of single-character
 * edits (insertions, deletions, substitutions) required to change one string into the other.
 */
export const levenshteinDistance = (a: string, b: string): number => {
  const rows = a.length + 1;
  const cols = b.length + 1;
  const matrix: number[][] = Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => 0)
  );

  for (let i = 0; i < rows; i += 1) {
    const row = matrix[i];
    if (row) {
      row[0] = i;
    }
  }

  const [firstRow] = matrix;
  if (firstRow) {
    for (let j = 0; j < cols; j += 1) {
      firstRow[j] = j;
    }
  }

  for (let i = 1; i < rows; i += 1) {
    for (let j = 1; j < cols; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      const currentRow = matrix[i];
      const prevRow = matrix[i - 1];
      if (currentRow && prevRow) {
        currentRow[j] = Math.min(
          (prevRow[j] ?? 0) + 1,
          (currentRow[j - 1] ?? 0) + 1,
          (prevRow[j - 1] ?? 0) + cost
        );
      }
    }
  }

  const lastRow = matrix[a.length];
  return lastRow?.[b.length] ?? 0;
};

export const stringSimilarity = (a: string, b: string): number => {
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) {
    return 1;
  }

  const distance = levenshteinDistance(a, b);
  return 1 - distance / maxLen;
};
