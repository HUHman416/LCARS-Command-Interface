import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "desktop-dist/**",
    ".vinext/**",
    ".open-next/**",
    "next-env.d.ts",
  ]),
  // These inherited, stateful console surfaces predate the React compiler
  // rules. Their effects intentionally synchronize LCARS with the local OS.
  {
    files: ["app/page.tsx", "app/v27-connected.tsx"],
    rules: {
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/purity": "off",
    },
  },
  // Electron's main process is deliberately CommonJS for builder compatibility.
  {
    files: ["desktop/**/*.cjs"],
    rules: { "@typescript-eslint/no-require-imports": "off" },
  },
]);

export default eslintConfig;
