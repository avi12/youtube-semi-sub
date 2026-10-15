import { YOUTUBE_MATCHES } from "./src/lib/youtube/site";
import { resolve } from "node:path";
import { functionsMixins } from "vite-plugin-functions-mixins";
import { defineConfig } from "wxt";

const REPOSITORY_URL = "https://github.com/avi12/youtube-semi-sub";
const AUTHOR_NAME = "Avi";
const AUTHOR_URL = "https://avi12.com";
// Apache-2.0 section 4: every distribution carries the license and the attribution NOTICE
const LEGAL_FILES = ["LICENSE", "NOTICE"];

export default defineConfig({
  manifest: ({ browser }) => ({
    name: "YouTube Semi-Subscribe",
    description: "Semi-subscribe to a YouTube channel - only the videos whose titles match your RegExp land in your subscriptions feed",
    homepage_url: REPOSITORY_URL,
    permissions: ["storage", "alarms"],
    host_permissions: YOUTUBE_MATCHES,
    // Floor set by the popup's m3-svelte live theme (relative colour syntax, CSS sign()/abs())
    ...browser === "chrome" && {
      minimum_chrome_version: "138"
    },
    ...browser === "firefox" && {
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
    }
  }),
  modules: ["@wxt-dev/module-svelte"],
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
