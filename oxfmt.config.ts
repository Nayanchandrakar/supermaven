import { defineConfig } from "oxfmt";

export default defineConfig({
  embeddedLanguageFormatting: "auto",
  endOfLine: "lf",
  ignorePatterns: ["dist/**"],
  jsdoc: true,
  tabWidth: 2,
  sortImports: {
    newlinesBetween: false,
    partitionByNewline: true
  },
  sortPackageJson: {
    sortScripts: true
  },
  trailingComma: "none"
});
