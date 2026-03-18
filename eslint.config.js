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
  // eslint.config.js — simple JavaScript config file
  // -----------------------------------------------------------------------
  {
    files: ["eslint.config.js"],
    plugins: { "no-secrets": noSecrets },
    rules: {
      "no-secrets/no-secrets": "warn",
    },
  },

  // -----------------------------------------------------------------------
  // Node/config files — vite.config.ts, vitest.config.ts
  // Uses tsconfig.node.json so the parser can resolve them.
  // -----------------------------------------------------------------------
  {
    files: ["vite.config.ts", "vitest.config.ts"],
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
  // App source — src/
  // -----------------------------------------------------------------------
  {
    files: ["src/**/*.{ts,tsx}"],
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
  // Convex backend — convex/**/*.ts
  // Uses TypeScript parser without type-aware rules (project-based typing conflicts).
  // -----------------------------------------------------------------------
  {
    files: ["convex/**/*.ts"],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      security.configs.recommended,
      prettierConfig,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.node,
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
      "jsdoc/require-param": "off",
      "jsdoc/require-returns": "off",
      "jsdoc/require-param-description": "off",
      "jsdoc/require-returns-description": "off",
      "jsdoc/check-param-names": "off",
      "jsdoc/check-tag-names": "off",

      // --- TypeScript (non type-aware) ---
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-floating-promises": "off",
      "@typescript-eslint/no-unsafe-assignment": "off",
      "@typescript-eslint/no-unsafe-call": "off",
      "@typescript-eslint/no-unsafe-member-access": "off",
      "@typescript-eslint/no-unsafe-return": "off",
      "@typescript-eslint/no-unsafe-argument": "off",
      "@typescript-eslint/require-await": "off",
      "@typescript-eslint/await-thenable": "off",
      "@typescript-eslint/no-misused-promises": "off",
      "@typescript-eslint/consistent-type-imports": "off",
      "@typescript-eslint/no-import-type-side-effects": "off",
      "@typescript-eslint/no-unnecessary-condition": "off",
      "@typescript-eslint/switch-exhaustiveness-check": "off",
      "no-shadow": "off",
      "@typescript-eslint/no-shadow": "off",

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
]);
