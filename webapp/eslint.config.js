import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist", "playwright-report", "test-results"] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": [
        "warn",
        { allowConstantExport: true },
      ],
    },
  },
  {
    // Playwright e2e tests run in Node environment
    files: ["e2e/**/*.{ts,js}", "playwright.config.ts"],
    languageOptions: {
      globals: globals.node,
    },
    rules: {
      // Playwright's `use()` is not a React hook — suppress false positives
      "react-hooks/rules-of-hooks": "off",
      // Test files legitimately use `any` for Firestore/REST payloads
      "@typescript-eslint/no-explicit-any": "off",
      // Allow _-prefixed unused variables (e.g. _config callback params)
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
);
