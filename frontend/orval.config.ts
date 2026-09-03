import { defineConfig } from "orval";

const openApiSchema = "../backend/schema.yaml";

export default defineConfig({
  api: {
    input: {
      target: openApiSchema,
    },
    output: {
      target: "./lib/api/generated/client",
      schemas: {
        path: "./lib/api/generated/models",
        splitByTags: true,
      },
      mode: "tags-split",
      client: "axios",
      headers: false,
      clean: true,
      formatter: "prettier",
      tagsSplitDeduplication: true,

      mock: {
        indexMockFiles: true,
        generators: [
          {
            type: "msw",
          },
          {
            type: "faker",
            schemas: true,
          },
        ],
      },
      override: {
        useNamedParameters: true,
      },
    },
  },

  validation: {
    input: {
      target: openApiSchema,
    },
    output: {
      target: "./lib/api/generated/validation/",
      schemas: {
        path: "./lib/api/generated/validation/schemas",
        type: "zod",
        splitByTags: true,
      },
      mode: "tags-split",
      client: "zod",
      schemaFileExtension: ".zod.ts",
      clean: true,
      formatter: "prettier",

      override: {
        zod: {
          version: 4,
          generateReusableSchemas: true,
        },
      },
    },
  },
});
