import { defineLayer } from "wxt-module-layers";

// Listed explicitly: scanned layer entrypoints keep their `.content` suffix in the output name
// (content-scripts/bridge.content.js), while a `<name>.content` key here builds content-scripts/<name>.js
export default defineLayer({
  entrypoints: {
    "bridge.content": "entrypoints/bridge.content.ts",
    "main-world.content": "entrypoints/main-world.content.ts",
    "page-styles.content": "entrypoints/page-styles.content.ts"
  }
});
