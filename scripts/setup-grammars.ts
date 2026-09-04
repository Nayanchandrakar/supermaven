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
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const RUNTIME_WASM_FILE = "web-tree-sitter.wasm";
const GRAMMAR_PACKAGE_PREFIX = "tree-sitter-";

interface WasmPath {
  from: string;
  to: string;
}

interface SetupContext {
  nodeModulesDir: string;
  grammarsDir: string;
  runtimeSource: string;
}

// The script lives in `<repo-root>/scripts/`, so the repo root is two directories up.
function createContext(): SetupContext {
  const rootDir = dirname(dirname(fileURLToPath(import.meta.url)));
  const nodeModulesDir = join(rootDir, "node_modules");

  return {
    nodeModulesDir,
    grammarsDir: join(rootDir, "grammars"),
    runtimeSource: join(nodeModulesDir, "web-tree-sitter", RUNTIME_WASM_FILE)
  };
}

function ensureNodeModules(context: SetupContext): void {
  if (!existsSync(context.nodeModulesDir)) {
    throw new Error(
      `node_modules not found at "${context.nodeModulesDir}". Run 'bun install' first.`
    );
  }
}

function discoverGrammarWasmFiles(context: SetupContext): WasmPath[] {
  const files: WasmPath[] = [];

  for (const entry of readdirSync(context.nodeModulesDir, { withFileTypes: true })) {
    if (!entry.isDirectory() || !entry.name.startsWith(GRAMMAR_PACKAGE_PREFIX)) {
      continue;
    }

    const packageDir = join(context.nodeModulesDir, entry.name);
    for (const file of readdirSync(packageDir)) {
      if (file.endsWith(".wasm") && file.startsWith(GRAMMAR_PACKAGE_PREFIX)) {
        files.push({
          from: join(packageDir, file),
          to: join(context.grammarsDir, file)
        });
      }
    }
  }

  return files;
}

function resetOutputDir(context: SetupContext): void {
  rmSync(context.grammarsDir, { recursive: true, force: true });
  mkdirSync(context.grammarsDir, { recursive: true });
}

function copyWasm(from: string, to: string): void {
  cpSync(from, to);
  console.log(`   copied: ${from} -> ${to}`);
}

function copyRuntime(context: SetupContext): void {
  if (existsSync(context.runtimeSource)) {
    copyWasm(context.runtimeSource, join(context.grammarsDir, RUNTIME_WASM_FILE));
    return;
  }

  console.warn(`Skipped: runtime wasm not found at "${context.runtimeSource}"`);
}

export function setupGrammars(context: SetupContext = createContext()): void {
  ensureNodeModules(context);

  const grammarFiles = discoverGrammarWasmFiles(context);
  console.log(`Setting up ${grammarFiles.length} grammar files in "${context.grammarsDir}"...`);

  resetOutputDir(context);

  for (const { from, to } of grammarFiles) {
    copyWasm(from, to);
  }

  copyRuntime(context);
  console.log("Done. Grammar files are ready in the 'grammars/' folder.");
}

setupGrammars();
