# Purpose
A browser extension that lets the user **semi-subscribe** to a YouTube channel: an unofficial "Semi-subscribe" button next to YouTube's own Subscribe button opens a dialog where the user sets a filter: a RegExp on the title, or a plain-language description a model judges (AI match). Only that channel's videos the filter lets through are inserted - animated - into the user's subscriptions feed (`/feed/subscriptions`). Works on `www.youtube.com` and `m.youtube.com`.

# Architecture
Features are `wxt-module-layers` layers in `src/layers/<name>/`: each owns its `entrypoints/` (if any) and exposes what other layers use through an `index.ts` barrel, imported as `#<name>`. Inside a layer, import its own files as `#<name>/...` (same directory: `./`); across layers only through the barrel. Code shared by several layers lives in `src/lib` (`@/lib/...`): `schemas/` (the core data shapes), `filter/` (the filter union, the AI verdict cache and its key), `ai/` (the AI status and chat-message shapes), `messaging/`, `page/`, `youtube/` (`schemas/`: the shared InnerTube pieces; `page/`: the MAIN-world page runtime, with the one `declare global` for YouTube's page globals and custom elements in `globals.ts`; plus URLs, endpoints and relative times), `utils/`, plus `storage.ts`, `semi-subscription-storage.ts` and `zod.ts`. A directory past about 8 files is split into meaningful subfolders.
- `background` - polls each semi-subscribed channel's uploads (RSS) on an alarm and caches them, unfiltered, in `local:channelVideos`. The only context that talks to the network outside the page. Its entrypoint stays at `src/entrypoints/background.ts`: wxt-module-layers turns any layer `background` entrypoint into its own virtual aggregate background. Also starts `#ai-match`.
- `ai-match` - judges AI filters, in the background: engine resolution (`engine/`), the Prompt API wrapper, the LiteRT-LM host (`engine/litert/`), the classifier (`classify/`: batching, prompt, verdict parsing) and the passes and opt-in lifecycle (`background/`). Owns the Chromium-only `offscreen-ai` entrypoint; also exports the popup's built-in-model download helper.
- `youtube` - the content scripts, composing the in-page layers (named in its `layer.config.ts`, so the output names stay `content-scripts/<name>.js`):
  - `bridge.content` - ISOLATED world, `document_start`. The only page-side context with storage access. `state-bridge.ts` computes `PageState` (settings + subscriptions + the filtered feed videos) and pushes it to the MAIN world on every storage change. Also mounts the dialog (`#dialog`).
  - `main-world.content` - MAIN world, `document_start`. Everything that needs YouTube's own JS objects: `#feed`, `#channel-button`, `#subscription-lists`. The one accessor on `ytInitialData` is `@/lib/youtube/page/initial-data-hook` - register an interceptor there, never define another. Reads state only through `@/lib/page/page-state`.
  - `page-styles.content` - page-level CSS (button, feed and list styles), imported from each layer.
- `feed` - MAIN world: the feed response hook and live feed insertion.
- `channel-button` - MAIN world: the Semi-subscribe button and official-subscription detection.
- `subscription-lists` - MAIN world: lists semi-subscribed channels in the sidebar guide and on `/feed/channels` (and their m.youtube.com equivalents), each with a way to open the dialog.
- `dialog` - ISOLATED world: the semi-subscribe dialog.
- `filter-editor` - `FilterEditor`, shared by the popup and the dialog.
- `popup` - manage semi-subscriptions and settings, including the AI match opt-in card (`ai/`: one store for the opt-in and download, shared with the editor's inline prompt).
- Message channels:
  - background <-> extension pages/ISOLATED: `@/lib/messaging/extension-messaging` (`defineExtensionMessaging`)
  - ISOLATED <-> MAIN: `@/lib/messaging/page-messaging` (`defineCustomEventMessaging`, namespace `youtube-semi-sub`)
  - Chromium service worker <-> its offscreen page (`offscreen-ai.html`, LiteRT-LM): the same extension messaging, `offscreenAi*` types
- Filtering lives in exactly one place: `selectFeedVideos` in `@/lib/filter/title-filter`, through `createVideoJudge`, which the editor preview and the popup rows reuse. Storage holds unfiltered uploads, so a filter edit applies instantly without a refetch. AI verdicts live in `local:aiVerdicts`, keyed by `getAiFilterKey` (normalized description + `AI_PROMPT_VERSION` - bump it with any prompt change) and video id; they are pruned with the channel caches.

# Constraints
- The Semi-subscribe button only appears for channels the user is **not** subscribed to. Pressing YouTube's own Subscribe on a semi-subscribed channel **halts** it (`isHalted`): the filter is kept, `selectFeedVideos` skips it, the background stops polling it, so no video of it (nor its Semi-unsubscribe menu item) reaches the feed. Officially unsubscribing resumes it. A subscribe or unsubscribe made elsewhere (another device, the app) is caught from server snapshots - the guide response's Subscriptions section and the `subscriptionStateEntity` values in YouTube's raw InnerTube data (a hard load's `ytInitialData`, every /browse and /next body - the app drops `frameworkUpdates` from its page data, so they are read on the way in) - through `applySubscriptionSnapshot` (`#channel-button`): each snapshot is applied once, what the tab saw the user do outranks it, and the guide only resumes a channel when its list wasn't cut short. On an open feed (`#feed` session), a halt hands the channel's inserted videos over to YouTube - never taken out; a resume takes out the channel's videos its filter rejects, judged per tile (title, or AI verdict - pending stays), animated; with ytaf present the grid is never written, ytaf is nudged to refetch instead. Management surfaces show it as "Paused - you're subscribed" and can still remove it.
- Semi-subscriptions are manageable from four places, all opening the same dialog or editor: the Semi-subscribe button, the YouTube sidebar's Subscriptions section (`#subscription-lists`), `/feed/channels` (same module), and the browser popup.
- A filter is either a RegExp or an **AI match** (a plain-language description judged per video by a model). AI is opt-in: nothing AI runs or downloads until the user enables it. Engine choice is a runtime check, the same on every browser: built-in AI (the Prompt API, `LanguageModel`) when available, otherwise LiteRT-LM (Gemma on WebGPU, model downloaded on opt-in). Verdicts are cached per (filter, video) so `selectFeedVideos` stays synchronous; a video without a verdict is pending and not inserted, and while AI match is off AI filters are paused (shown as such, never silently empty).
  - The background never starts the built-in model's download: it only runs it when `availability()` is `available`. The download is `create()` from a click in the popup. The local model downloads only on an explicit opt-in request.
  - Sessions are never reused across batches: one base session per pass, a `clone()` per batch. Model output is validated with zod; skipped ids stay pending. Video text is quoted as JSON and the system prompt forbids following instructions inside it.
  - LiteRT-LM runs in Firefox's background event page and in Chromium's offscreen page (the service worker has no DOM). Only the JSPI + relaxed-SIMD wasm build ships (copied by `wxt.config.ts`), so engine resolution requires both features (Chromium 137+, Firefox 153+). Its model lives in our own CacheStorage bucket; the cache is the only source of truth for "downloaded".
- All UI is Svelte 5. In-page UI (content scripts, MAIN or ISOLATED world) is mounted with `mount()` and looks native to YouTube; Polymer elements may sit in Svelte templates with `.data` set from a MAIN-world `$effect`. The popup is Material 3 Expressive via `m3-svelte`. `FilterEditor.svelte` is shared by the popup and the in-page dialog, so it stays library-free and is themed only through its `--filter-editor-*` custom properties.
- Mutate YouTube's Polymer components through their model (`el.set("data.contents", ...)`, `.data = ...`), never through `innerHTML`.
- InnerTube shapes are modelled as zod schemas (optional fields, `looseObject` passthrough) and read only through those guards - never index into raw shapes.
- Section structure of the feed is read-only: only add videos within a section, never reorder or move section markers.
- **Pairing with YouTube Auto Feed** (`avi12/youtube-auto-feed`, "ytaf"): ytaf rewrites the feed grid from YouTube's own `FEsubscriptions` `/browse` response every 5 s and removes anything not in it. So semi-sub videos are injected into the *response* (hooked below every `fetch` wrapper), which makes ytaf keep and animate them itself. When ytaf is present (`globalThis.__ytafFeedMessenger`), never write the grid directly - nudge it to refetch with `BroadcastChannel("ytaf")` `{ type: "subscription-change" }`.

# Stack
- pnpm
- WXT extension framework, with `wxt-module-layers` for the layers (WXT 0.21 needs the `@davestewart/wxt-utils` patch in `patches/`)
- Svelte 5 for every UI surface; popup with `m3-svelte` (Material 3 Expressive, its CSS needs the `vite-plugin-functions-mixins` plugin registered in `wxt.config.ts`)
- TypeScript (100% type safety, let TypeScript infer return types - never write them explicitly; type predicates are the exception)
- zod for every loose payload (storage, messages, InnerTube, RSS); import `z` from `@/lib/zod` (jitless CSP wrapper - YouTube's Trusted Types block zod's eval probe)
- `@webext-core/messaging` for message passing, `wxt/storage` (`storage.defineItem` in `@/lib/storage`) for storage
- Chromium (Chrome, Edge, Opera) MV3 + Firefox MV3, single shared code path; branch only when an API genuinely diverges

# Code style
- Use the `browser` namespace
- Use early returns for readability and maintainability
- Use functional programming
- Use async/await whenever possible
- Use DRY with separation of concerns, prioritizing readability
- Minimize indentations
- Use `for-of` instead of `.forEach`, and a plain `for` loop instead of `.reduce()`
- Use modern browser and CSS features
- Prefer semantic HTML elements (`button`, `nav`, `ul`/`li`, `section`, `header`, `dialog`, `output`, etc.) over `div`/`span` with a `role`; only add ARIA when no native element carries the semantics or state
- Avoid `window.` prefixes unless it increases readability
- Avoid `setTimeout` unless absolutely necessary
- Avoid comments unless absolutely necessary - prefer descriptive names
- Don't use em dashes - use regular hyphens
- If a callback arrow function has a typed param, don't annotate the type explicitly
- Functions with 2+ params take a single destructured object param (`f({ a, b }: {...})`). Reuse an existing type for the object when one fits (a zod-inferred type, `Pick<PageState, "subscriptions">`, a library's options type); only inline the object type when nothing fits. The one exception we write ourselves: an event-subscription function takes `(eventName, callback)` positionally. Signatures someone else dictates stay positional (callbacks passed to a call, object-literal members implementing a type, Svelte actions/transitions, a function replacing a native API). Enforced by `local/single-object-param`
- Avoid nested try/catch - flatten with early returns or extracted functions
- Validate loose data with zod, not hand-rolled checks: a module-level schema + `safeParse`. Validity only: `schema.safeParse(x).success` inline or into an `is`-prefixed boolean. `.data`/`.error` consumed: store the result as `parsed` and guard with `parsed.success`
- Inline one-off variables when it stays readable - but keep a named variable for a magic number/string or an opaque expression
- Extract an `if`/ternary/guard condition into a descriptive `is`-prefixed boolean
- Always prefer the `@` path alias over parent-relative (`../`) imports; same-directory `./foo` stays relative
- No `as` casts (oxlint `consistent-type-assertions: never`) - narrow with zod guards or type predicates
- Zod first, never TypeScript alone: every data shape is a zod schema with its type derived via `z.infer` - no hand-written object type aliases or data-only interfaces (lint-enforced). Interfaces remain only for behaviour (method signatures such as protocol maps and element APIs), `declare global` augmentation and Svelte `Props`. Validate at every boundary: storage (`defineSchemaItem` in `@/lib/storage` validates every read and write), messages, InnerTube/RSS/DOM data and model output. Reuse zod objects: one schema per shape, and derive variants from it (`.extend`, `.pick`, `.omit`, `.partial`, shared sub-schemas such as InnerTube text/thumbnail/renderer/browse pieces in `@/lib/youtube/schemas`) instead of redefining a shape that already exists

# Naming conventions
- Variables and functions: `camelCase`, full words (no abbreviations)
- Module-level constants: `SCREAMING_SNAKE_CASE`
- Exception: event handler first parameter is always `e`

## Variable prefixes
- Element: `el` prefix (e.g. `elButton`)
- Index: `i` prefix (e.g. `iItem`), or bare `i` when iterating in a for loop/higher-order function
- Boolean: `is` prefix (e.g. `isLoading`), phrased positively (e.g. `isEnabled`, not `isDisabled`)

# Hardcoded values
- Strings: use enums; if no enum fits, use a descriptive `SCREAMING_SNAKE_CASE` constant
- Numbers: use a descriptive `SCREAMING_SNAKE_CASE` constant

# Svelte
- Single-use functions: inline them
- Event handlers used in exactly one place: inline them as an arrow function in the template
- Never put a ternary inside `$derived` - use `$derived.by` with if/else
- `@attach` arrow functions in templates: extract to named functions in the script block
- Flow-gating buttons use both `disabled={!condition}` AND a guard in the handler

# CSS
- Use native CSS nesting
- Always respect `prefers-reduced-motion` - never ship an ungated transition/animation. In JS read `prefersReducedMotion()` from `@/lib/utils/motion`
- Never the `transform` shorthand - use the individual `translate`/`rotate`/`scale` properties
- Never hand-write vendor prefixes
- On YouTube, style with YouTube's own tokens (`--yt-sys-color-baseline--*`, `--yt-spec-*`) with fallbacks, so injected UI follows its light/dark theme

# Storage
- Don't automatically persist to storage - rely on fallback values; only write when the user has explicitly set something (the background's upload cache and AI verdict cache are the exceptions: they are caches)
- Use the `storage.defineItem` items in `@/lib/storage`; read-modify-write goes through `mutateStorageItem`, and every semi-subscription write through `@/lib/semi-subscription-storage`
- Only `local:` or `sync:` - never `session:` (Firefox)

# UI copy
- No full stops at end of messages
- Informal tone

# Linting
After each modification, run:
- `pnpm lint` (oxlint `--fix` pass, `eslint --fix`, then oxlint as the gate) - oxlint owns logic and type-aware rules, ESLint owns style
- `pnpm stylelint`
- `pnpm svelte:check`
- `pnpm compile`
- `pnpm test` (vitest, tests sit next to code as `*.test.ts`)
- `pnpm fallow` - dead-code audit; remove what a change left unused (never `fallow fix`)

# Dev
- `pnpm dev` (Chromium) / `pnpm dev:firefox`
- Firefox first when verifying cross-browser behaviour - it is the strictest environment
