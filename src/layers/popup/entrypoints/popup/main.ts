import { mount } from "svelte";

import { readStoredState, updateAvailableVersionItem } from "@/lib/storage";

import App from "./App.svelte";

import "./popup.css";

// Read before mounting, so the popup opens on the stored state instead of flashing the empty state
mount(App, {
  target: document.getElementById("app") ?? document.body,
  props: {
    initialState: await readStoredState(),
    initialUpdateVersion: await updateAvailableVersionItem.getValue()
  }
});
