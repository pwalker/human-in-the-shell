import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    exclude: ["outside-examples/**", "node_modules/**", "dist/**"],
    passWithNoTests: true,
  },
});
