import { defineConfig } from 'oxlint'

export default defineConfig({
    categories: {
        correctness: "warn",
        perf: "warn",
        style: "warn",
        suspicious: "warn",
    },
    ignorePatterns: ["dist/**"],
    options: {
        typeAware: true,
        typeCheck: true,
    },
    plugins: ["unicorn", "typescript", "oxc"],
    rules: {
        "eslint/func-style": "off",
        "eslint/no-unused-vars": "error",
        "eslint/prefer-const": "error",
        "no-alert": "error",
        "no-plusplus": ["error", { allowForLoopAfterthoughts: true }],
        "typescript/no-floating-promises": "error",
        "typescript/no-unsafe-assignment": "warn",
        "typescript/no-unsafe-type-assertion": "off",
        "typescript/restrict-template-expressions": "off",
        "unicorn/empty-brace-spaces": "off",
    },
})
