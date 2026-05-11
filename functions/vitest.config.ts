import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: [
      // TypeScript source files imported with .js extension (NodeNext pattern)
      { find: /^(\.{1,2}\/.+)\.js$/, replacement: "$1" },
    ],
  },
  test: {
    environment: "node",
    include: ["test/**/*.test.ts"],
  },
});
