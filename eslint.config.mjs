import globals from "globals";
import pluginJs from "@eslint/js";
import tseslint from "typescript-eslint";


/** @type {import('eslint').Linter.Config[]} */
export default [
  {languageOptions: { globals: {
    ...globals.browser,
    // `process.env.*` is string-replaced at build time by @rollup/plugin-replace
    process: "readonly"
  }}},
  pluginJs.configs.recommended,
  {
    files: ["test/**/*.mjs"],
    languageOptions: {
      globals: {
        ...globals.mocha
      }
    }
  },
  ...tseslint.configs.recommended.map(config => ({
    ...config,
    files: ["src/**/*.mts", "src/**/*.ts"]
  })),
  {
    rules: {
      "no-unused-vars": "warn",
      // module-scope declarations shadowing browser globals (Event, Set, Map, ...) are fine;
      // legacy .mjs files contain benign duplicate `var` declarations, cleaned up on conversion
      "no-redeclare": ["warn", { builtinGlobals: false }],
      // pre-existing patterns in src; treat as warnings like no-unused-vars
      "no-useless-assignment": "warn",
      "no-prototype-builtins": "warn"
    }
  },
  {
    files: ["src/**/*.mts", "src/**/*.ts"],
    rules: {
      "no-unused-vars": "off",
      "@typescript-eslint/no-unused-vars": "warn",
      // the codebase style uses `let` pervasively; keep conversion diffs minimal
      "prefer-const": "off",
      // converted files must be clean; the TS-aware rule understands
      // type/value namespacing and declaration merging
      "no-redeclare": "off",
      "@typescript-eslint/no-redeclare": ["error", { builtinGlobals: false }],
      // type-only ambient groupings (e.g. `declare namespace Css`) are an
      // accepted pattern for namespaced type families consumed as `Css.Node`
      "@typescript-eslint/no-namespace": ["error", { allowDeclarations: true }]
    }
  },
  {
    // CommonJS entrypoint for using raw source in cjs projects
    files: ["src/cjs.mjs"],
    languageOptions: { globals: globals.commonjs }
  }
];
