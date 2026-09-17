#!/usr/bin/env -S bun run
/// <reference types="node" />

/**
 * Copies the tree-sitter grammar `.wasm` files (plus the web-tree-sitter runtime `.wasm`) from
 * `node_modules` into the top-level `grammars/` directory.
 *
 * This runs automatically after every `bun install` via the `postinstall` script, and can also be
 * executed manually:
 */
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import path from "node:path";

import {
  GRAMMARS_DIR_NAME,
  RUNTIME_WASM_FILE,
} from "../src/constants/grammars";

const GRAMMAR_PACKAGE_PREFIX = "tree-sitter-";

const { dirname, join } = path;

interface WasmPath {
  from: string;
  to: string;
}

interface SetupContext {
  nodeModulesDir: string;
  grammarsDir: string;
  runtimeSource: string;
}

export const createContext = (): SetupContext => {
  const rootDir = dirname(import.meta.dirname);
  const nodeModulesDir = join(rootDir, "node_modules");

  return {
    grammarsDir: join(rootDir, GRAMMARS_DIR_NAME),
    nodeModulesDir,
    runtimeSource: join(nodeModulesDir, "web-tree-sitter", RUNTIME_WASM_FILE),
  };
};

const ensureNodeModules = (context: SetupContext): void => {
  if (!existsSync(context.nodeModulesDir)) {
    throw new Error(
      `node_modules not found at "${context.nodeModulesDir}". Run 'bun install' first.`
    );
  }
};

const discoverGrammarWasmFiles = (context: SetupContext): WasmPath[] => {
  const files: WasmPath[] = [];

  for (const entry of readdirSync(context.nodeModulesDir, {
    withFileTypes: true,
  })) {
    if (
      !entry.isDirectory() ||
      !entry.name.startsWith(GRAMMAR_PACKAGE_PREFIX)
    ) {
      continue;
    }

    const packageDir = join(context.nodeModulesDir, entry.name);
    for (const file of readdirSync(packageDir)) {
      if (file.endsWith(".wasm") && file.startsWith(GRAMMAR_PACKAGE_PREFIX)) {
        files.push({
          from: join(packageDir, file),
          to: join(context.grammarsDir, file),
        });
      }
    }
  }

  return files;
};

const resetOutputDir = (context: SetupContext): void => {
  rmSync(context.grammarsDir, { force: true, recursive: true });
  mkdirSync(context.grammarsDir, { recursive: true });
};

const copyWasm = (from: string, to: string): void => {
  cpSync(from, to);
  console.log(`   copied: ${from} -> ${to}`);
};

const copyRuntime = (context: SetupContext): void => {
  if (existsSync(context.runtimeSource)) {
    copyWasm(
      context.runtimeSource,
      join(context.grammarsDir, RUNTIME_WASM_FILE)
    );
    return;
  }

  console.warn(`Skipped: runtime wasm not found at "${context.runtimeSource}"`);
};

export const setupGrammars = (
  context: SetupContext = createContext()
): void => {
  ensureNodeModules(context);

  const grammarFiles = discoverGrammarWasmFiles(context);
  console.log(
    `Setting up ${grammarFiles.length} grammar files in "${context.grammarsDir}"...`
  );

  resetOutputDir(context);

  for (const { from, to } of grammarFiles) {
    copyWasm(from, to);
  }

  copyRuntime(context);
  console.log("Done. Grammar files are ready in the 'grammars/' folder.");
};

if (import.meta.main) {
  setupGrammars();
}
