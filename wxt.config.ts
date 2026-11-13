import { copyFileSync, existsSync, mkdirSync, readdirSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";

import { functionsMixins } from "vite-plugin-functions-mixins";
import { defineConfig } from "wxt";

import { YOUTUBE_MATCHES } from "./src/lib/youtube/site";

const REPOSITORY_URL = "https://github.com/avi12/youtube-semi-sub";
const AUTHOR_NAME = "Avi";
const AUTHOR_URL = "https://avi12.com";
// Apache-2.0 section 4: every distribution carries the license and the attribution NOTICE
const LEGAL_FILES = ["LICENSE", "NOTICE"];
const LAYERS_DIR = "src/layers";
// The opt-in local AI model (LiteRT-LM) compiles its wasm in extension pages, and lives in CacheStorage (1.9 GB)
const EXTENSION_PAGES_CSP = "script-src 'self' 'wasm-unsafe-eval'; object-src 'self'";
// LiteRT-LM's runtime is loaded from the package instead of its default jsDelivr CDN, which the CSP blocks. It ships
// four builds (JSPI or asyncify x relaxed SIMD or not); the extension only ever picks LiteRT where JSPI and relaxed
// SIMD both exist (Chromium 137+, Firefox 153+ - see probeLiteRtSupport), so only that build is copied, saving ~60 MB
const LITERT_WASM_DIR = "litertlm-wasm";
const LITERT_WASM_FILES = ["litertlm_wasm_internal.js", "litertlm_wasm_internal.wasm"];

/** Copies the LiteRT-LM runtime from node_modules, so the shipped copy always matches the installed version */
function copyLiteRtWasm(outDir: string) {
  const packageDir = dirname(createRequire(import.meta.url).resolve("@litert-lm/core/package.json"));
  const destinationDir = join(outDir, LITERT_WASM_DIR);
  mkdirSync(destinationDir, { recursive: true });
  for (const file of LITERT_WASM_FILES) {
    const source = join(packageDir, "wasm", file);
    const destination = join(destinationDir, file);
    // Dev rebuilds often - skip the 22 MB copy when it is already there
    const isCopied = existsSync(destination) && statSync(destination).size === statSync(source).size;
    if (!isCopied) {
      copyFileSync(source, destination);
    }
  }
}

export default defineConfig({
  manifest: ({ browser }) => ({
    name: "YouTube Semi-Subscribe",
    description:
      "Filter what a YouTube channel puts in your feed: follow it without subscribing, or subscribe and hide what you don't want",
    homepage_url: REPOSITORY_URL,
    permissions: [
      "storage",
      "alarms",
      // The opt-in local AI model is 1.9 GB of CacheStorage
      "unlimitedStorage",
      // Chromium's service worker runs that model in an offscreen page; Firefox's background page runs it itself
      ...(browser === "firefox" ? [] : ["offscreen"])
    ],
    host_permissions: YOUTUBE_MATCHES,
    content_security_policy: {
      extension_pages: EXTENSION_PAGES_CSP
    },
    // Floor set by the popup's m3-svelte live theme (relative colour syntax, CSS sign()/abs())
    ...(browser === "chrome" && {
      minimum_chrome_version: "138"
    }),
    ...(browser === "firefox" && {
      developer: {
        name: AUTHOR_NAME,
        url: AUTHOR_URL
      },
      options_ui: {
        page: "popup.html"
      },
      browser_specific_settings: {
        gecko: {
          id: "youtube-semi-sub@avi12.com",
          strict_min_version: "142.0",
          data_collection_permissions: {
            required: ["none"]
          }
        }
      }
    })
  }),
  modules: ["@wxt-dev/module-svelte", "wxt-module-layers"],
  // wxt-module-layers' glob sources ("src/layers/*") break on Windows (path.resolve turns the trailing /* into \*,
  // which its endsWith("/*") check misses), so the layer dirs are listed explicitly
  layers: {
    sources: readdirSync(new URL(LAYERS_DIR, import.meta.url), { withFileTypes: true })
      .filter(entry => entry.isDirectory())
      .map(entry => `${LAYERS_DIR}/${entry.name}`)
  },
  srcDir: "src",
  publicDir: "src/public",
  zip: {
    includeSources: [
      "package.json",
      "pnpm-lock.yaml",
      "pnpm-workspace.yaml",
      "patches/**",
      "README.md",
      ...LEGAL_FILES,
      "wxt.config.ts",
      "src/**"
    ],
    sourcesTemplate: "{{name}}-{{version}}-{{browser}}-source.zip"
  },
  hooks: {
    "build:done"(wxt) {
      copyLiteRtWasm(wxt.config.outDir);
    },
    "build:publicAssets"(_, assets) {
      for (const file of LEGAL_FILES) {
        assets.push({
          absoluteSrc: resolve(file),
          relativeDest: file
        });
      }
    }
  },
  vite: () => ({
    // m3-svelte's styles use CSS @function/@mixin, which this plugin compiles away
    plugins: [functionsMixins({ deps: ["m3-svelte"] })],
    build: {
      sourcemap: false
    }
  })
});
