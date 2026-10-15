import { svelte } from "@sveltejs/vite-plugin-svelte";
import { defineConfig } from "vitest/config";
import { WxtVitest } from "wxt/testing/vitest-plugin";

export default defineConfig({
  plugins: [svelte(), WxtVitest()],
  test: {
    include: ["src/**/*.test.ts"]
  }
});
