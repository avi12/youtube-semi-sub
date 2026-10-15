import App from "./App.svelte";
import "./popup.css";
import { loadPopupState } from "#popup/popup-state";
import { mount } from "svelte";

mount(App, {
  target: document.getElementById("app") ?? document.body,
  props: {
    initialState: await loadPopupState()
  }
});
