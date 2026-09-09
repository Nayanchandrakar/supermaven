export const JS_TS_REQUIRE_PATTERN =
  /^\s*(?:const|let|var)\s+\w+\s*=\s*require\s*\(/u;
export const OPEN_PAREN_PATTERN = /\(/gu;
export const CLOSE_PAREN_PATTERN = /\)/gu;
export const PARENS_PATTERN = /[()]/gu;
export const TRAILING_BACKSLASH_PATTERN = /\\$/u;
export const WHITESPACE_PATTERN = /\s+/u;
export const WORD_PATTERN = /^\w+$/u;
export const TYPE_PREFIX_PATTERN = /^type\s+/u;
export const JS_AS_PATTERN = /(?<original>\w+)\s+as\s+(?<alias>\w+)/u;
export const JS_COLON_ALIAS_PATTERN = /(?<original>\w+)\s*:\s*(?<alias>\w+)/u;
export const PYTHON_FROM_PATTERN =
  /^from\s+(?<module>\S+)\s+import\s+(?<importPart>.+)$/u;
export const PYTHON_IMPORT_PATTERN = /^import\s+(?<modules>.+)$/u;
export const PYTHON_AS_PATTERN = /(?<original>[\w.]+)\s+as\s+(?<alias>\w+)/u;
export const PYTHON_FROM_AS_PATTERN = /(?<original>\w+)\s+as\s+(?<alias>\w+)/u;
export const RUST_ALIAS_PATTERN = /^(?<original>\w+)\s+as\s+(?<alias>\w+)$/u;
export const GO_QUOTE_PATTERN = /"/gu;
export const COMMA_PATTERN = /,/u;

export const JS_TS_DEFAULT_PATTERN =
  /import\s+(?:type\s+)?(?<defaultName>\w+)\s+from\s+['"][^'"]+['"]/gu;
export const JS_TS_NAMED_PATTERN =
  /import\s*(?:type\s*)?\{(?<names>[^}]+)\}\s*from\s*['"][^'"]+['"]/gu;
export const JS_TS_NAMESPACE_PATTERN =
  /import\s+\*\s+as\s+(?<namespace>\w+)\s+from\s+['"][^'"]+['"]/gu;
export const JS_TS_REQUIRE_NAMED_PATTERN =
  /(?:const|let|var)\s+(?<name>\w+)\s*=\s*require\s*\(\s*['"][^'"]+['"]\s*\)/gu;
export const JS_TS_REQUIRE_DESTRUCTURED_PATTERN =
  /(?:const|let|var)\s+\{(?<names>[^}]+)\}\s*=\s*require\s*\(\s*['"][^'"]+['"]\s*\)/gu;
export const RUST_SIMPLE_PATTERN =
  /^\s*(?:pub\s+)?use\s+(?:[\w:]+::)?(?<name>\w+)\s*;/gmu;
export const RUST_ALIAS_IMPORT_PATTERN =
  /^\s*(?:pub\s+)?use\s+(?:[\w:]+::)?(?<original>\w+)\s+as\s+(?<alias>\w+)\s*;/gmu;
export const RUST_MULTI_PATTERN =
  /^\s*(?:pub\s+)?use\s+[\w:]+::\{(?<items>[^}]+)\}\s*;/gmu;
export const JAVA_IMPORT_PATTERN = /^\s*import\s+(?<path>[\w.]+)\s*;/gmu;
