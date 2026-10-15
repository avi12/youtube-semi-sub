import App from "./App.svelte";
import "./popup.css";
import { readStoredState } from "@/lib/storage";
import { mount } from "svelte";

// Read before mounting, so the popup opens on the stored state instead of flashing the empty state
mount(App, {
  target: document.getElementById("app") ?? document.body,
  props: {
    initialState: await readStoredState()
  }
});
