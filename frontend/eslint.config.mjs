import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import prettier from "eslint-config-prettier/flat";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  prettier,
  {
    files: ["**/*.{js,jsx,mjs,cjs,ts,tsx}"],
    ignores: ["lib/backend/**", "**/*.test.{ts,tsx}", "test/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              regex: "^@/lib/backend/generated(?:/|$)",
              message:
                "Import generated Django artifacts through server-only lib/backend modules.",
            },
          ],
        },
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "coverage/**",
    "next-env.d.ts",
    "lib/backend/generated/**",
  ]),
]);

export default eslintConfig;
