import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: [
      "client/**/*.{test,spec}.{ts,tsx}",
      "shared/**/*.{test,spec}.{ts,tsx}",
      "server/**/*.{test,spec}.{ts,tsx}",
    ],
    exclude: [
      "node_modules/**",
      "dist/**",
      "scripts/**",
      "drizzle/**",
    ],
    environment: "node",
    globals: true,
    passWithNoTests: true,
  },
});
