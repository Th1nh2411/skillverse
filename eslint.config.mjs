import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["**/node_modules/**", "**/.next/**", "**/.next-*/**", "**/screenshots/**", "**/dist/**", "**/generated/**", "**/coverage/**", "**/playwright-report/**", "**/test-results/**", "**/next-env.d.ts"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    // Service worker (PWA): chạy trong ServiceWorkerGlobalScope
    files: ["**/public/sw.js"],
    languageOptions: {
      globals: { self: "readonly", caches: "readonly", fetch: "readonly", Response: "readonly", Request: "readonly", URL: "readonly", clients: "readonly", console: "readonly" },
    },
  },
  {
    rules: {
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
      "no-restricted-syntax": [
        "error",
        { selector: "Literal[value=/[\\u{1F300}-\\u{1FAFF}\\u{2600}-\\u{27BF}]/u]", message: "Không dùng emoji trong giao diện/copy." },
      ],
    },
  },
);
