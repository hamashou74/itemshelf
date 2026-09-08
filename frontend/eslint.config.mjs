import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import prettier from "eslint-config-prettier/flat";

const generatedBackendImportRegex = "(?:^|/)(?:lib/)?backend/generated(?:/|$)";
const generatedBackendNonMockImportRegex =
  "(?:^|/)(?:lib/)?backend/generated(?:/|$)(?!.*\\.(?:msw|faker)$)";

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
              regex: generatedBackendImportRegex,
              message:
                "Import generated Django artifacts through server-only lib/backend modules.",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["**/*.test.{ts,tsx}", "test/**/*.{js,jsx,mjs,cjs,ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              regex: generatedBackendNonMockImportRegex,
              message:
                "Tests may import generated Django artifacts directly only for MSW and Faker helpers.",
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
