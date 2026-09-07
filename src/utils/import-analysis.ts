import {
  CLOSE_PAREN_PATTERN,
  COMMA_PATTERN,
  GO_QUOTE_PATTERN,
  JAVA_IMPORT_PATTERN,
  JS_AS_PATTERN,
  JS_COLON_ALIAS_PATTERN,
  JS_TS_DEFAULT_PATTERN,
  JS_TS_NAMED_PATTERN,
  JS_TS_NAMESPACE_PATTERN,
  JS_TS_REQUIRE_DESTRUCTURED_PATTERN,
  JS_TS_REQUIRE_NAMED_PATTERN,
  JS_TS_REQUIRE_PATTERN,
  OPEN_PAREN_PATTERN,
  PARENS_PATTERN,
  PYTHON_AS_PATTERN,
  PYTHON_FROM_AS_PATTERN,
  PYTHON_FROM_PATTERN,
  PYTHON_IMPORT_PATTERN,
  RUST_ALIAS_IMPORT_PATTERN,
  RUST_ALIAS_PATTERN,
  RUST_MULTI_PATTERN,
  RUST_SIMPLE_PATTERN,
  TRAILING_BACKSLASH_PATTERN,
  TYPE_PREFIX_PATTERN,
  WHITESPACE_PATTERN,
  WORD_PATTERN,
} from "@/constants/import-patterns";
import type { ImportBindings, LineSpan } from "@/types";
import { isJavaScriptOrTypeScript } from "@/utils/language";

type RecordBinding = (original: string, local?: string) => void;

const getLine = (lines: string[], index: number): string =>
  lines.at(index) ?? "";

const getLastSpanEnd = (spans: LineSpan[]): number | undefined =>
  spans.at(-1)?.end;

const countParenDepth = (line: string): number =>
  (line.match(OPEN_PAREN_PATTERN) ?? []).length -
  (line.match(CLOSE_PAREN_PATTERN) ?? []).length;

const isJsTsImportStart = (trimmed: string, line: string): boolean => {
  if (trimmed.startsWith("import ")) {
    return true;
  }
  if (trimmed.startsWith("export ") && trimmed.includes(" from ")) {
    return true;
  }
  return JS_TS_REQUIRE_PATTERN.test(line);
};

const findJsTsImportEnd = (
  lines: string[],
  startIndex: number,
  trimmed: string
): number => {
  let endIndex = startIndex;
  if (trimmed.includes("{") && !trimmed.includes("}")) {
    while (endIndex < lines.length && !getLine(lines, endIndex).includes("}")) {
      endIndex += 1;
    }
    return endIndex;
  }
  if (!trimmed.endsWith(";") && !trimmed.includes(" from ")) {
    while (
      endIndex < lines.length &&
      !getLine(lines, endIndex).includes(" from ") &&
      !getLine(lines, endIndex).trim().endsWith(";")
    ) {
      endIndex += 1;
    }
  }
  return endIndex;
};

const isJsTsNonImportCode = (trimmed: string): boolean => {
  if (trimmed === "") {
    return false;
  }
  if (trimmed.startsWith("//")) {
    return false;
  }
  if (trimmed.startsWith("/*")) {
    return false;
  }
  if (trimmed.startsWith("*")) {
    return false;
  }
  if (trimmed.startsWith("import")) {
    return false;
  }
  if (trimmed.startsWith("export")) {
    return false;
  }
  return !trimmed.includes("require(");
};

const findJsTsImportSpans = (lines: string[], spans: LineSpan[]): void => {
  let i = 0;
  while (i < lines.length) {
    const line = getLine(lines, i);
    const trimmed = line.trim();

    if (isJsTsImportStart(trimmed, line)) {
      const startLine = i;
      const endLine = findJsTsImportEnd(lines, i, trimmed);
      spans.push({ end: endLine, start: startLine });
      i = endLine + 1;
      continue;
    }

    const lastEnd = getLastSpanEnd(spans);
    if (
      i > 0 &&
      lastEnd !== undefined &&
      isJsTsNonImportCode(trimmed) &&
      i > lastEnd + 10
    ) {
      break;
    }

    i += 1;
  }
};

const isPythonBlankOrComment = (trimmed: string): boolean => {
  if (trimmed === "") {
    return true;
  }
  if (trimmed.startsWith("#")) {
    return true;
  }
  if (trimmed.startsWith('"""')) {
    return true;
  }
  return trimmed.startsWith("'''");
};

const findPythonImportEnd = (
  lines: string[],
  startIndex: number,
  trimmed: string
): number => {
  let endIndex = startIndex;
  let parenDepth = countParenDepth(getLine(lines, endIndex));
  if (parenDepth > 0) {
    while (endIndex < lines.length && parenDepth > 0) {
      endIndex += 1;
      if (endIndex < lines.length) {
        parenDepth += countParenDepth(getLine(lines, endIndex));
      }
    }
    return endIndex;
  }
  if (trimmed.endsWith("\\")) {
    while (
      endIndex < lines.length &&
      getLine(lines, endIndex).trim().endsWith("\\")
    ) {
      endIndex += 1;
    }
  }
  return endIndex;
};

const findPythonImportSpans = (lines: string[], spans: LineSpan[]): void => {
  let i = 0;
  while (i < lines.length) {
    const trimmed = getLine(lines, i).trim();

    if (trimmed.startsWith("import ") || trimmed.startsWith("from ")) {
      const endLine = findPythonImportEnd(lines, i, trimmed);
      spans.push({ end: endLine, start: i });
      i = endLine + 1;
      continue;
    }

    const lastEnd = getLastSpanEnd(spans);
    if (
      !isPythonBlankOrComment(trimmed) &&
      lastEnd !== undefined &&
      i > lastEnd + 5
    ) {
      break;
    }

    i += 1;
  }
};

const isRustImportStart = (trimmed: string): boolean => {
  if (trimmed.startsWith("use ")) {
    return true;
  }
  if (trimmed.startsWith("pub use ")) {
    return true;
  }
  if (trimmed.startsWith("mod ")) {
    return true;
  }
  return trimmed.startsWith("pub mod ");
};

const isRustBlankOrAnnotation = (trimmed: string): boolean => {
  if (trimmed === "") {
    return true;
  }
  if (trimmed.startsWith("//")) {
    return true;
  }
  if (trimmed.startsWith("/*")) {
    return true;
  }
  if (trimmed.startsWith("*")) {
    return true;
  }
  return trimmed.startsWith("#[");
};

const findRustImportSpans = (lines: string[], spans: LineSpan[]): void => {
  let i = 0;
  while (i < lines.length) {
    const trimmed = getLine(lines, i).trim();

    if (isRustImportStart(trimmed)) {
      const startLine = i;
      while (i < lines.length && !getLine(lines, i).includes(";")) {
        i += 1;
      }
      spans.push({ end: i, start: startLine });
      i += 1;
      continue;
    }

    const lastEnd = getLastSpanEnd(spans);
    if (
      !isRustBlankOrAnnotation(trimmed) &&
      lastEnd !== undefined &&
      i > lastEnd + 5
    ) {
      break;
    }

    i += 1;
  }
};

const isGoImportBlockStart = (trimmed: string): boolean =>
  trimmed.includes("(") || trimmed === "import(" || trimmed === "import (";

const isGoBlankOrComment = (trimmed: string): boolean => {
  if (trimmed === "") {
    return true;
  }
  if (trimmed.startsWith("//")) {
    return true;
  }
  if (trimmed.startsWith("/*")) {
    return true;
  }
  return trimmed.startsWith("*");
};

const findGoImportSpans = (lines: string[], spans: LineSpan[]): void => {
  let i = 0;
  while (i < lines.length) {
    const trimmed = getLine(lines, i).trim();

    if (
      trimmed.startsWith("import ") ||
      trimmed === "import(" ||
      trimmed === "import ("
    ) {
      const startLine = i;
      if (isGoImportBlockStart(trimmed)) {
        while (i < lines.length && !getLine(lines, i).trim().startsWith(")")) {
          i += 1;
        }
      }
      spans.push({ end: i, start: startLine });
      i += 1;
      continue;
    }

    if (trimmed.startsWith("package ")) {
      spans.push({ end: i, start: i });
      i += 1;
      continue;
    }

    const lastEnd = getLastSpanEnd(spans);
    if (
      !isGoBlankOrComment(trimmed) &&
      lastEnd !== undefined &&
      i > lastEnd + 5
    ) {
      break;
    }

    i += 1;
  }
};

const isJavaBlankOrAnnotation = (trimmed: string): boolean => {
  if (trimmed === "") {
    return true;
  }
  if (trimmed.startsWith("//")) {
    return true;
  }
  if (trimmed.startsWith("/*")) {
    return true;
  }
  if (trimmed.startsWith("*")) {
    return true;
  }
  return trimmed.startsWith("@");
};

const findJavaImportSpans = (lines: string[], spans: LineSpan[]): void => {
  let i = 0;
  while (i < lines.length) {
    const trimmed = getLine(lines, i).trim();

    if (trimmed.startsWith("import ") || trimmed.startsWith("package ")) {
      spans.push({ end: i, start: i });
      i += 1;
      continue;
    }

    if (!isJavaBlankOrAnnotation(trimmed) && spans.length > 0) {
      break;
    }

    i += 1;
  }
};

const isCBlankOrComment = (trimmed: string): boolean => {
  if (trimmed === "") {
    return true;
  }
  if (trimmed.startsWith("//")) {
    return true;
  }
  if (trimmed.startsWith("/*")) {
    return true;
  }
  return trimmed.startsWith("*");
};

const isCGuardDirective = (trimmed: string): boolean => {
  if (trimmed.startsWith("#pragma")) {
    return true;
  }
  if (trimmed.startsWith("#ifndef")) {
    return true;
  }
  if (trimmed.startsWith("#define")) {
    return true;
  }
  return trimmed.startsWith("#endif");
};

const findCIncludeSpans = (lines: string[], spans: LineSpan[]): void => {
  for (let i = 0; i < lines.length; i += 1) {
    const trimmed = getLine(lines, i).trim();

    if (trimmed.startsWith("#include")) {
      let endLine = i;
      while (
        endLine < lines.length &&
        getLine(lines, endLine).trimEnd().endsWith("\\")
      ) {
        endLine += 1;
      }
      spans.push({ end: endLine, start: i });
    } else if (
      !isCGuardDirective(trimmed) &&
      !isCBlankOrComment(trimmed) &&
      spans.length > 0
    ) {
      break;
    }
  }
};

export const removeLineSpans = (text: string, spans: LineSpan[]): string => {
  if (spans.length === 0) {
    return text;
  }

  const lines = text.split("\n");
  const toRemove = new Set<number>();

  for (const span of spans) {
    for (let i = span.start; i <= span.end && i < lines.length; i += 1) {
      toRemove.add(i);
    }
  }

  const kept: string[] = [];
  for (let i = 0; i < lines.length; i += 1) {
    if (!toRemove.has(i)) {
      const line = lines.at(i);
      if (line !== undefined) {
        kept.push(line);
      }
    }
  }

  return kept.join("\n");
};

export const findImportLineSpans = (
  text: string,
  languageId: string
): LineSpan[] => {
  const lines = text.split("\n");
  const spans: LineSpan[] = [];

  if (isJavaScriptOrTypeScript(languageId)) {
    findJsTsImportSpans(lines, spans);
  } else if (languageId === "python") {
    findPythonImportSpans(lines, spans);
  } else if (languageId === "rust") {
    findRustImportSpans(lines, spans);
  } else if (languageId === "go") {
    findGoImportSpans(lines, spans);
  } else if (languageId === "java") {
    findJavaImportSpans(lines, spans);
  } else if (languageId === "c" || languageId === "cpp") {
    findCIncludeSpans(lines, spans);
  }

  return spans;
};

const recordJsTsNamedList = (
  rawNames: string,
  record: RecordBinding,
  separator: RegExp,
  aliasPattern: RegExp,
  stripTypePrefix: boolean
): void => {
  const names = rawNames.split(separator);
  for (const name of names) {
    const asMatch = aliasPattern.exec(name);
    const original = asMatch?.groups?.["original"];
    const alias = asMatch?.groups?.["alias"];
    if (original && alias) {
      record(original, alias);
      continue;
    }
    const trimmedName = name.trim();
    const cleanName = stripTypePrefix
      ? trimmedName.replace(TYPE_PREFIX_PATTERN, "")
      : trimmedName;
    if (cleanName && WORD_PATTERN.test(cleanName)) {
      record(cleanName, cleanName);
    }
  }
};

const parseJsTsImports = (text: string, record: RecordBinding): void => {
  let match: RegExpExecArray | null;

  JS_TS_DEFAULT_PATTERN.lastIndex = 0;
  while ((match = JS_TS_DEFAULT_PATTERN.exec(text)) !== null) {
    const defaultName = match.groups?.["defaultName"];
    if (defaultName) {
      record(defaultName, defaultName);
    }
  }

  JS_TS_NAMED_PATTERN.lastIndex = 0;
  while ((match = JS_TS_NAMED_PATTERN.exec(text)) !== null) {
    const names = match.groups?.["names"];
    if (names) {
      recordJsTsNamedList(names, record, COMMA_PATTERN, JS_AS_PATTERN, true);
    }
  }

  JS_TS_NAMESPACE_PATTERN.lastIndex = 0;
  while ((match = JS_TS_NAMESPACE_PATTERN.exec(text)) !== null) {
    const namespace = match.groups?.["namespace"];
    if (namespace) {
      record(namespace, namespace);
    }
  }

  JS_TS_REQUIRE_NAMED_PATTERN.lastIndex = 0;
  while ((match = JS_TS_REQUIRE_NAMED_PATTERN.exec(text)) !== null) {
    const name = match.groups?.["name"];
    if (name) {
      record(name, name);
    }
  }

  JS_TS_REQUIRE_DESTRUCTURED_PATTERN.lastIndex = 0;
  while ((match = JS_TS_REQUIRE_DESTRUCTURED_PATTERN.exec(text)) !== null) {
    const names = match.groups?.["names"];
    if (names) {
      recordJsTsNamedList(
        names,
        record,
        COMMA_PATTERN,
        JS_COLON_ALIAS_PATTERN,
        false
      );
    }
  }
};

interface CollectedPythonImport {
  importPart: string;
  nextIndex: number;
}

const collectPythonFromImportPart = (
  lines: string[],
  startIndex: number,
  initialPart: string
): CollectedPythonImport => {
  let importPart = initialPart;
  let index = startIndex;
  if (importPart.includes("(") && !importPart.includes(")")) {
    index += 1;
    while (index < lines.length && !getLine(lines, index).includes(")")) {
      importPart = `${importPart} ${getLine(lines, index).trim()}`;
      index += 1;
    }
    if (index < lines.length) {
      importPart = `${importPart} ${getLine(lines, index).trim()}`;
    }
    return { importPart, nextIndex: index };
  }
  if (importPart.endsWith("\\")) {
    while (
      index < lines.length &&
      getLine(lines, index).trim().endsWith("\\")
    ) {
      index += 1;
      if (index < lines.length) {
        const continuation = getLine(lines, index)
          .trim()
          .replace(TRAILING_BACKSLASH_PATTERN, "");
        importPart = `${importPart} ${continuation}`;
      }
    }
  }
  return { importPart, nextIndex: index };
};

const recordPythonFromNames = (
  importPart: string,
  record: RecordBinding
): void => {
  const cleaned = importPart.replaceAll(PARENS_PATTERN, "");
  const names = cleaned.split(",");
  for (const name of names) {
    const asMatch = PYTHON_FROM_AS_PATTERN.exec(name);
    const original = asMatch?.groups?.["original"];
    const alias = asMatch?.groups?.["alias"];
    if (original && alias) {
      record(original, alias);
      continue;
    }
    const cleanName = name.trim();
    if (cleanName && cleanName !== "*" && WORD_PATTERN.test(cleanName)) {
      record(cleanName, cleanName);
    }
  }
};

const recordPythonImportModules = (
  modulesPart: string,
  record: RecordBinding
): void => {
  const modules = modulesPart.split(",");
  for (const module of modules) {
    const asMatch = PYTHON_AS_PATTERN.exec(module);
    const original = asMatch?.groups?.["original"];
    const alias = asMatch?.groups?.["alias"];
    if (original && alias) {
      const [moduleName] = original.split(".");
      if (moduleName) {
        record(moduleName, alias);
      }
      continue;
    }
    const [moduleName] = module.trim().split(".");
    if (moduleName && WORD_PATTERN.test(moduleName)) {
      record(moduleName, moduleName);
    }
  }
};

const parsePythonImports = (text: string, record: RecordBinding): void => {
  const lines = text.split("\n");
  let i = 0;

  while (i < lines.length) {
    const trimmed = getLine(lines, i).trim();

    const fromMatch = PYTHON_FROM_PATTERN.exec(trimmed);
    const importPart = fromMatch?.groups?.["importPart"];
    if (fromMatch && importPart !== undefined) {
      const collected = collectPythonFromImportPart(lines, i, importPart);
      recordPythonFromNames(collected.importPart, record);
      i = collected.nextIndex + 1;
      continue;
    }

    const importMatch = PYTHON_IMPORT_PATTERN.exec(trimmed);
    const modulesPart = importMatch?.groups?.["modules"];
    if (importMatch && modulesPart !== undefined) {
      recordPythonImportModules(modulesPart, record);
    }

    i += 1;
  }
};

const recordRustMultiItems = (items: string, record: RecordBinding): void => {
  const splitItems = items.split(COMMA_PATTERN);
  for (const item of splitItems) {
    const trimmed = item.trim();
    if (!trimmed || trimmed === "self" || trimmed === "super") {
      continue;
    }
    const asMatch = RUST_ALIAS_PATTERN.exec(trimmed);
    const original = asMatch?.groups?.["original"];
    const alias = asMatch?.groups?.["alias"];
    if (original && alias) {
      record(original, alias);
    } else if (WORD_PATTERN.test(trimmed)) {
      record(trimmed, trimmed);
    }
  }
};

const recordRustSimpleMatch = (
  match: RegExpExecArray,
  record: RecordBinding
): void => {
  const [full] = match;
  if (full?.includes(" as ")) {
    return;
  }
  const name = match.groups?.["name"];
  if (name) {
    record(name, name);
  }
};

const recordRustAliasMatch = (
  match: RegExpExecArray,
  record: RecordBinding
): void => {
  const original = match.groups?.["original"];
  const alias = match.groups?.["alias"];
  if (original && alias) {
    record(original, alias);
  }
};

const parseRustImports = (text: string, record: RecordBinding): void => {
  let match: RegExpExecArray | null;

  RUST_SIMPLE_PATTERN.lastIndex = 0;
  while ((match = RUST_SIMPLE_PATTERN.exec(text)) !== null) {
    recordRustSimpleMatch(match, record);
  }

  RUST_ALIAS_IMPORT_PATTERN.lastIndex = 0;
  while ((match = RUST_ALIAS_IMPORT_PATTERN.exec(text)) !== null) {
    recordRustAliasMatch(match, record);
  }

  RUST_MULTI_PATTERN.lastIndex = 0;
  while ((match = RUST_MULTI_PATTERN.exec(text)) !== null) {
    const items = match.groups?.["items"];
    if (items) {
      recordRustMultiItems(items, record);
    }
  }
};

const parseGoImportLine = (line: string, record: RecordBinding): void => {
  const clean = line.replaceAll(GO_QUOTE_PATTERN, "").trim();
  if (!clean) {
    return;
  }

  const parts = clean.split(WHITESPACE_PATTERN);
  const [first, second] = parts;
  if (parts.length === 1 && first) {
    const pathParts = first.split("/");
    const pkgName = pathParts.at(-1);
    if (pkgName && pkgName !== "." && pkgName !== "_") {
      record(pkgName, pkgName);
    }
    return;
  }
  if (parts.length >= 2 && first && second) {
    const pathParts = second.split("/");
    const pkgName = pathParts.at(-1);
    if (first !== "." && first !== "_") {
      record(pkgName || first, first);
    }
  }
};

const parseGoImports = (text: string, record: RecordBinding): void => {
  const lines = text.split("\n");
  let inBlock = false;

  for (const line of lines) {
    const trimmed = line.trim();

    if (
      trimmed === "import (" ||
      trimmed === "import(" ||
      trimmed.startsWith("import (")
    ) {
      inBlock = true;
      continue;
    }

    if (inBlock) {
      if (trimmed.startsWith(")")) {
        inBlock = false;
        continue;
      }
      parseGoImportLine(trimmed, record);
      continue;
    }

    if (trimmed.startsWith("import ")) {
      const rest = trimmed.slice(7).trim();
      parseGoImportLine(rest, record);
    }
  }
};

const parseJavaImports = (text: string, record: RecordBinding): void => {
  JAVA_IMPORT_PATTERN.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = JAVA_IMPORT_PATTERN.exec(text)) !== null) {
    const path = match.groups?.["path"];
    if (!path || path.endsWith(".*")) {
      continue;
    }
    const parts = path.split(".");
    const className = parts.at(-1);
    if (className) {
      record(className, className);
    }
  }
};

export const parseImportBindings = (
  text: string,
  languageId: string
): ImportBindings => {
  const importedOriginalNames = new Set<string>();
  const importedAliasesByOriginal = new Map<string, Set<string>>();
  const importedLocalNames = new Set<string>();

  const recordBinding: RecordBinding = (original: string, local?: string) => {
    const orig = original.trim();
    if (!orig) {
      return;
    }

    importedOriginalNames.add(orig);

    const localName = (local ?? original).trim();
    if (!localName) {
      return;
    }

    let aliases = importedAliasesByOriginal.get(orig);
    if (!aliases) {
      aliases = new Set();
      importedAliasesByOriginal.set(orig, aliases);
    }
    aliases.add(localName);
    importedLocalNames.add(localName);
  };

  if (isJavaScriptOrTypeScript(languageId)) {
    parseJsTsImports(text, recordBinding);
  } else if (languageId === "python") {
    parsePythonImports(text, recordBinding);
  } else if (languageId === "rust") {
    parseRustImports(text, recordBinding);
  } else if (languageId === "go") {
    parseGoImports(text, recordBinding);
  } else if (languageId === "java") {
    parseJavaImports(text, recordBinding);
  }

  return {
    importedAliasesByOriginal,
    importedLocalNames,
    importedOriginalNames,
  };
};

export const getLastNLines = (text: string, n: number): string => {
  const lines = text.split("\n");
  return lines.slice(-n).join("\n");
};
