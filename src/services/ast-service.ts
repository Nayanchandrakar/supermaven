import path from "node:path";

import * as TreeSitter from "web-tree-sitter";

import { LANGUAGE_MAP } from "@/constants/language-map";

type LanguageKey = keyof typeof LANGUAGE_MAP;

const isLanguageKey = (key: string): key is LanguageKey => key in LANGUAGE_MAP;

export class AstService {
  private readonly grammarsDir: string;
  private readonly languageCache = new Map<string, TreeSitter.Language>();
  private parser: TreeSitter.Parser | null = null;
  private currentLanguageId: string | null = null;
  private isInitialized = false;

  constructor(extPath: string) {
    this.grammarsDir = path.join(extPath, "grammers");
  }

  get isReady(): boolean {
    return this.isInitialized;
  }

  async initialize() {
    try {
      const wasmPath = path.join(this.grammarsDir, "web-tree-sitter.wasm");

      await TreeSitter.Parser.init({
        locateFile: () => wasmPath,
      });

      this.parser = new TreeSitter.Parser();
      this.isInitialized = true;
    } catch {
      this.isInitialized = false;
    }
  }

  async ensureLanguage(languageId: string): Promise<boolean> {
    if (!this.isInitialized || !this.parser) {
      return false;
    }

    if (!isLanguageKey(languageId)) {
      return false;
    }

    const wasmFile = LANGUAGE_MAP[languageId];
    if (!wasmFile) {
      return false;
    }

    if (this.languageCache.has(wasmFile)) {
      const cachedLanguage = this.languageCache.get(wasmFile);
      if (cachedLanguage && this.currentLanguageId !== languageId) {
        this.parser.setLanguage(cachedLanguage);
        this.currentLanguageId = languageId;
      }
      return true;
    }

    try {
      const wasmPath = path.join(this.grammarsDir, wasmFile);
      const language = await TreeSitter.Language.load(wasmPath);
      this.languageCache.set(wasmFile, language);
      this.parser.setLanguage(language);
      this.currentLanguageId = languageId;
      return true;
    } catch {
      return false;
    }
  }

  parseSync(code: string): TreeSitter.Tree | null {
    if (!this.isInitialized || !this.parser) {
      return null;
    }

    return this.parser.parse(code);
  }

  withParsedTree<T>(code: string, fn: (tree: TreeSitter.Tree) => T): T | null {
    const tree = this.parseSync(code);
    if (!tree) {
      return null;
    }
    try {
      return fn(tree);
    } finally {
      tree.delete();
    }
  }

  dispose(): void {
    this.parser?.delete();
    this.parser = null;
    this.languageCache.clear();
    this.isInitialized = false;
  }
}
