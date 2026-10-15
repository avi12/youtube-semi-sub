import { YOUTUBE_MATCHES } from "@/lib/youtube/site";
import { registerSemiSubDialog } from "#dialog";
import { startStateBridge } from "#youtube/state-bridge";

export default defineContentScript({
  matches: YOUTUBE_MATCHES,
  runAt: "document_start",
  cssInjectionMode: "ui",
  main(context) {
    startStateBridge(context);
    registerSemiSubDialog(context);
  }
});
