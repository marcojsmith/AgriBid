import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import jsdoc from "eslint-plugin-jsdoc";
import importX from "eslint-plugin-import-x";
import noSecrets from "eslint-plugin-no-secrets";
import tseslint from "typescript-eslint";
import prettierConfig from "eslint-config-prettier/flat";
import security from "eslint-plugin-security";
import { defineConfig, globalIgnores } from "eslint/config";

/** Shared plugins used across multiple config blocks. */
const sharedPlugins = {
  jsdoc,
  "import-x": importX,
  "no-secrets": noSecrets,
};

/** Shared settings used across multiple config blocks. */
const sharedSettings = {
  jsdoc: { mode: "typescript" },
};

export default defineConfig([
  globalIgnores(["dist", "convex/_generated", "coverage"]),

  // -----------------------------------------------------------------------
  // Node/config files — vite.config.ts, vitest.config.ts, eslint.config.js
  // Uses tsconfig.node.json so the parser can resolve them.
  // -----------------------------------------------------------------------
  {
    files: ["vite.config.ts", "vitest.config.ts"],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      security.configs.recommended,
      prettierConfig,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.node,
      parserOptions: {
        project: "./tsconfig.node.json",
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: sharedPlugins,
    settings: sharedSettings,
    rules: {
      // Config files don't need JSDoc
      "jsdoc/require-jsdoc": "off",
      "no-secrets/no-secrets": "warn",
    },
  },

  // -----------------------------------------------------------------------
  // App source — src/ and convex/
  // -----------------------------------------------------------------------
  {
    files: ["src/**/*.{ts,tsx}", "convex/**/*.ts"],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      // tseslint.configs.strictTypeChecked,
      // tseslint.configs.stylisticTypeChecked,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
      security.configs.recommended,
      prettierConfig,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        project: "./tsconfig.json",
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: sharedPlugins,
    settings: sharedSettings,
    rules: {
      // --- JSDoc ---
      "jsdoc/require-jsdoc": [
        "error",
        {
          publicOnly: true,
          require: {
            FunctionDeclaration: true,
            MethodDefinition: true,
            ClassDeclaration: true,
            ArrowFunctionExpression: true,
            FunctionExpression: true,
          },
          contexts: [
            "ExportNamedDeclaration > FunctionDeclaration",
            "ExportDefaultDeclaration > FunctionDeclaration",
            "ExportNamedDeclaration > VariableDeclaration > VariableDeclarator > ArrowFunctionExpression",
            "ExportNamedDeclaration > VariableDeclaration > VariableDeclarator > FunctionExpression",
          ],
        },
      ],
      "jsdoc/require-param": "error",
      "jsdoc/require-returns": "error",
      "jsdoc/require-param-description": "warn",
      "jsdoc/require-returns-description": "warn",
      "jsdoc/check-param-names": "warn",
      "jsdoc/check-tag-names": "warn",

      // --- TypeScript (type-aware) ---
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-floating-promises": "warn",
      "@typescript-eslint/no-unsafe-assignment": "warn",
      "@typescript-eslint/no-unsafe-call": "warn",
      "@typescript-eslint/no-unsafe-member-access": "warn",
      "@typescript-eslint/no-unsafe-return": "warn",
      "@typescript-eslint/no-unsafe-argument": "warn",
      "@typescript-eslint/require-await": "warn",
      "@typescript-eslint/await-thenable": "warn",
      "@typescript-eslint/no-misused-promises": [
        "warn",
        { checksVoidReturn: { attributes: false } },
      ],
      "@typescript-eslint/consistent-type-imports": [
        "warn",
        { prefer: "type-imports", fixStyle: "inline-type-imports" },
      ],
      "@typescript-eslint/no-import-type-side-effects": "warn",
      "@typescript-eslint/no-unnecessary-condition": "warn",
      "@typescript-eslint/switch-exhaustiveness-check": "warn",
      "no-shadow": "off",
      "@typescript-eslint/no-shadow": "warn",

      // --- React ---
      "react-hooks/rules-of-hooks": "warn",
      "react-hooks/exhaustive-deps": "warn",

      // --- Security ---
      "no-secrets/no-secrets": "warn",

      // --- Imports ---
      "import-x/no-duplicates": "warn",
      "import-x/no-cycle": "warn",
      "import-x/no-self-import": "warn",
      "import-x/no-useless-path-segments": "warn",
      "import-x/order": [
        "error",
        {
          groups: [
            "builtin",
            "external",
            "internal",
            ["parent", "sibling", "index"],
          ],
          pathGroups: [{ pattern: "@/**", group: "internal" }],
          "newlines-between": "always",
        },
      ],
    },
  },

  // -----------------------------------------------------------------------
  // File-scoped override for getMyBidsCountHandler
  // -----------------------------------------------------------------------
  {
    files: ["convex/auctions/queries/bids.ts"],
    rules: {
      "no-secrets/no-secrets": [
        "warn",
        { ignoreIdentifiers: ["getMyBidsCountHandler"] },
      ],
    },
  },
]);