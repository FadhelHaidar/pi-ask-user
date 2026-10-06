import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@juicesharp/rpiv-test-utils": fileURLToPath(new URL("./test/utils/index.ts", import.meta.url)),
    },
  },
  test: {
    include: ["**/*.test.ts"],
    exclude: ["node_modules/**"],
    setupFiles: ["./test/setup.ts"],
    maxWorkers: 4,
    hookTimeout: 30000,
    testTimeout: 15000,
    unstubGlobals: true,
    clearMocks: true,
    restoreMocks: true,
  },
});
