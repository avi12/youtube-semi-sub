import { svelte } from "lint-config/eslint/svelte";

export default svelte({
  ignores: [
    ".output/",
    ".wxt/",
    "user-profiles/",
    ".chrome-for-testing/",
    "tools/assets/browsers/",
    "tools/assets/payload/"
  ]
});
