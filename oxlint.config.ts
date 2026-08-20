import { defineConfig } from "oxlint";

export default defineConfig({
  categories: {
    perf: "warn",
    suspicious: "warn",
    correctness: "warn"
  },
  options: {
    typeAware: true,
    typeCheck: true
  },
  plugins: ["unicorn", "typescript", "oxc"],
  rules: {
    "no-shadow": "off",
    "no-alert": "error",
    "eslint/prefer-const": "error",
    "eslint/no-unused-vars": "error",
    "unicorn/empty-brace-spaces": "off",
    "typescript/consistent-return": "off",
    "no-constant-binary-expression": "off",
    "typescript/no-unsafe-assignment": "warn",
    "typescript/no-floating-promises": "error",
    "typescript/no-unsafe-type-assertion": "off",
    "typescript/restrict-template-expressions": "off"
  }
});
