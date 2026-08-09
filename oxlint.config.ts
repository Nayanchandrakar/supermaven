import { defineConfig } from "oxlint";

export default defineConfig({
  categories: {
    correctness: "warn",
    perf: "warn",
    suspicious: "warn"
  },
  options: {
    typeAware: true,
    typeCheck: true
  },
  plugins: ["unicorn", "typescript", "oxc"],
  rules: {
    "no-alert": "error",
    "no-shadow": "off",
    "eslint/prefer-const": "error",
    "eslint/no-unused-vars": "error",
    "typescript/consistent-return": "off",
    "no-plusplus": ["error", { allowForLoopAfterthoughts: true }],
    "typescript/no-floating-promises": "error",
    "typescript/no-unsafe-assignment": "warn",
    "typescript/no-unsafe-type-assertion": "off",
    "typescript/restrict-template-expressions": "off",
    "unicorn/empty-brace-spaces": "off"
  }
});
