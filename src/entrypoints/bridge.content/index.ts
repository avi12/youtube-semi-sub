import { startStateBridge } from "@/features/bridge/state-bridge";
import { registerSemiSubDialog } from "@/features/dialog";
import { YOUTUBE_MATCHES } from "@/lib/youtube/site";

export default defineContentScript({
  matches: YOUTUBE_MATCHES,
  runAt: "document_start",
  cssInjectionMode: "ui",
  main(context) {
    startStateBridge(context);
    registerSemiSubDialog(context);
  }
});
