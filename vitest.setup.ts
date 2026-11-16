import { Window } from "happy-dom";
import { vi } from "vitest";

// Node has no DOMParser, which the RSS feed is read with
vi.stubGlobal("DOMParser", new Window().DOMParser);
