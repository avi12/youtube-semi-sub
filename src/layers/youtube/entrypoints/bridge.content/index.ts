import { YOUTUBE_MATCHES } from "@/lib/youtube/site";
import { registerSemiSubDialog } from "#dialog";
import { startStateBridge } from "#youtube/state-bridge";

export default defineContentScript({
  matches: YOUTUBE_MATCHES,
  runAt: "document_start",
  // The dialog lives in the page's own DOM, so its styles go in as a page stylesheet - every rule is scoped by Svelte
  cssInjectionMode: "manifest",
  main(context) {
    startStateBridge(context);
    registerSemiSubDialog(context);
  }
});
