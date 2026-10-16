# Purpose
A browser extension that filters what a YouTube channel puts into the user's subscriptions feed (`/feed/subscriptions`). A button next to YouTube's own Subscribe button opens a dialog where the user sets a filter: a RegExp on the title, or a plain-language description a model judges (AI match). Each semi-subscribed channel is in one of two modes, decided by the user's real YouTube subscription - the user subscribes and unsubscribes with YouTube's own button, the extension never does:
- **"Follow without subscribing"** - not subscribed: the channel's *follow filter* picks its videos to **add** - animated - to the feed: regular videos into its Latest band, Shorts into the Shorts shelf the feed already has.
- **"Subscribe with a filter"** - subscribed, so YouTube keeps recommending the channel: the channel's *hide filter* picks its videos to **hide** from the feed's Latest band and Shorts shelf.

Works on `www.youtube.com` and `m.youtube.com`.

# Architecture
Features are `wxt-module-layers` layers in `src/layers/<name>/`: each owns its `entrypoints/` (if any) and exposes what other layers use through an `index.ts` barrel, imported as `#<name>`. Inside a layer, import its own files as `#<name>/...` (same directory: `./`); across layers only through the barrel. Code shared by several layers lives in `src/lib` (`@/lib/...`): `schemas/` (the core data shapes), `filter/` (the filter union, the AI verdict cache and its key), `ai/` (the AI status and chat-message shapes), `messaging/`, `page/`, `youtube/` (`schemas/`: the shared InnerTube pieces; `page/`: the MAIN-world page runtime, with the one `declare global` for YouTube's page globals and custom elements in `globals.ts`; plus URLs, endpoints and relative times), `utils/`, plus `storage.ts`, `semi-subscription-storage.ts` and `zod.ts`. A directory past about 8 files is split into meaningful subfolders.
- `background` - polls the uploads (RSS) of every followed channel, and of every subscribed one whose hide filter hides something (`isUploadsWatched`), on an alarm and caches them, unfiltered, in `local:channelVideos`; an upload RSS links as `/shorts/<id>` is marked `isShort` (the Videos-tab fallback never lists Shorts). The only context that talks to the network outside the page. Its entrypoint stays at `src/entrypoints/background.ts`: wxt-module-layers turns any layer `background` entrypoint into its own virtual aggregate background. Also starts `#ai-match`.
- `ai-match` - judges AI filters, in the background: engine resolution (`engine/`), the Prompt API wrapper, the LiteRT-LM host (`engine/litert/`), the classifier (`classify/`: batching and the prompt, `classify/judges/` one judge per engine, `classify/reply/` reading the model's verdicts) and the passes and opt-in lifecycle (`background/`). Owns the Chromium-only `offscreen-ai` entrypoint; also exports the popup's built-in-model download helper and the local model's size label.
- `youtube` - the content scripts, composing the in-page layers (named in its `layer.config.ts`, so the output names stay `content-scripts/<name>.js`):
  - `bridge.content` - ISOLATED world, `document_start`. The only page-side context with storage access. `state-bridge.ts` computes `PageState` (settings + subscriptions + the followed channels' filtered feed videos + the subscribed channels' hidden upload ids) and pushes it to the MAIN world on every storage change. Also mounts the dialog (`#dialog`).
  - `main-world.content` - MAIN world, `document_start`. Everything that needs YouTube's own JS objects: `#feed`, `#channel-button`, `#subscription-lists`. The one accessor on `ytInitialData` is `@/lib/youtube/page/initial-data-hook` - register an interceptor there, never define another. Reads state only through `@/lib/page/page-state`.
  - `page-styles.content` - page-level CSS: imports each in-page layer's stylesheet (`#channel-button`, `#feed`, `#subscription-lists`).
- `feed` - MAIN world: the feed response hook and the live feed: insertion into, and hiding from, the Latest band (`compose/band/`) and the Shorts shelf (`compose/shelf/`).
- `channel-button` - MAIN world: the channel button, its words for every surface (`describeChannelButton`), and official-subscription detection.
- `subscription-lists` - MAIN world: lists every semi-subscribed channel on `/feed/channels` (www and m), and the followed ones in the sidebar guide and m's avatar strip; a subscribed channel gets the manage button on YouTube's own sidebar entry. Each opens the dialog.
- `dialog` - ISOLATED world: the semi-subscribe dialog, on the channel's current mode.
- `filter-editor` - `FilterEditor`, shared by the popup and the dialog.
- `popup` - manage semi-subscriptions and settings, including the AI match opt-in card (`ai/`: one store for the opt-in and download, shared with the editor's inline prompt).
- Message channels - each message's payload and reply have one zod schema in its messaging module, which `defineValidatedMessaging` derives the types from and checks on both ends (the handler gets the payload parsed, the sender the reply). Message type values are kebab-case, like every wire value the extension defines:
  - background <-> extension pages/ISOLATED: `@/lib/messaging/extension-messaging` (`defineExtensionMessaging`)
  - ISOLATED <-> MAIN: `@/lib/messaging/page-messaging` (`defineCustomEventMessaging`, namespace `youtube-semi-sub`)
  - Chromium service worker <-> its offscreen page (`offscreen-ai.html`, LiteRT-LM): the same extension messaging, `offscreenAi*` types
- Filtering lives in exactly one module, `@/lib/filter/title-filter`: `selectFeedVideos` (the follow filters' additions) and `selectHiddenVideoIds` (the hide filters' cached uploads), through `createModeJudge`/`createVideoJudge`, which the feed's per-tile hiding, the editor preview and the popup rows reuse. A mode's filter is null until the user saves one in that mode, and an unset filter adds or hides nothing; an empty RegExp lets every video through as a follow filter and hides nothing as a hide filter. Both cases are decided only by `isFilterInert`. Storage holds unfiltered uploads, so a filter edit applies instantly without a refetch. AI verdicts live in `local:aiVerdicts`, keyed by `getAiFilterKey` (normalized description + `AI_PROMPT_VERSION` - bump it with any prompt change) and video id; they are pruned with the channel caches.

# Constraints
- The channel button appears on **every** channel and opens the dialog for the mode that applies: always "Semi-subscribe", or "Semi-subscribed" (filter glyph) once the mode's filter adds or hides something.
- A semi-subscription stores `isSubscribed` plus a `followFilter` and a `hideFilter` (storage v4 migrated `filter` into `followFilter` and `isHalted` into `isSubscribed`, with no hide filter set). Pressing YouTube's own Subscribe switches the channel to hiding: nothing is deleted, the follow filter is kept for a later unsubscribe, and `selectFeedVideos` adds nothing of it (nor its Semi-unsubscribe menu item). A new semi-subscription sets only the filter of the mode it is saved in; the other stays null, so a channel first saved while subscribed adds nothing after an unsubscribe until its follow filter is set. Officially unsubscribing switches it back to following. A subscribe or unsubscribe made elsewhere (another device, the app) is caught from server snapshots - the guide response's Subscriptions section and the `subscriptionStateEntity` values in YouTube's raw InnerTube data (a hard load's `ytInitialData`, every /browse and /next body - the app drops `frameworkUpdates` from its page data, so they are read on the way in) - through `applySubscriptionSnapshot` (`#channel-button`): each snapshot is applied once, what the tab saw the user do outranks it, and the guide only switches a channel back to following when its list wasn't cut short. On an open feed (`#feed` session), subscribing hands the channel's inserted videos over to YouTube - never taken out as follow videos; unsubscribing (a "resume" in the session's terms) takes out the channel's videos its follow filter rejects, judged per tile (title, or AI verdict - pending stays), animated; with ytaf present the grid is never written, ytaf is nudged to refetch instead. Every management surface names the mode ("Follow without subscribing" / "Subscribe with a filter", `SUBSCRIPTION_MODE_NAME`) and edits that mode's filter.
- **Hiding** (a subscribed channel's hide filter): a video is hidden only on a definite match - one still waiting for its AI verdict stays visible, and nothing is hidden while AI match is off. A band tile is attributed to its channel with `channelIdFromGridItem` and judged by its title or verdict; a Short names no channel, so it is matched by video id against the channel's cached uploads (`PageState.hiddenVideoIds`), as is a video several channels share - hidden only when it is that channel's own upload. Hidden videos leave the Latest band and the Shorts shelf (`findHiddenVideoIds` in `#feed/feed-session`): in every subscriptions-feed response (first pages, www's and m's later pages, a hard load's `ytInitialData` on both), and on an open grid through the same animated write that removes semi-sub videos. Taking items out never narrows the loaded span insertions are held to.
- Semi-subscriptions are manageable from four places, all opening the same dialog or editor: the channel button, the YouTube sidebar's Subscriptions section (`#subscription-lists`), `/feed/channels` (same module), and the browser popup. The sidebar (and m's avatar strip) get an entry of ours only for a followed channel; a subscribed one is already listed by YouTube, and in the sidebar its own entry gets the manage button.
- A filter is either a RegExp or an **AI match** (a plain-language description judged per video by a model). AI is opt-in: nothing AI runs or downloads until the user enables it. Engine choice is a runtime check, the same on every browser: built-in AI (the Prompt API, `LanguageModel`) when available, otherwise LiteRT-LM (Gemma on WebGPU, model downloaded on opt-in). Verdicts are cached per (filter, video) so `selectFeedVideos` stays synchronous; a video without a verdict is pending and not inserted, and while AI match is off AI filters are paused (shown as such, never silently empty).
  - The background never starts the built-in model's download: it only runs it when `availability()` is `available`. The download is `create()` from a click in the popup. The local model downloads only on an explicit opt-in request.
  - Sessions are never reused across batches: one base session per pass, a `clone()` per batch. Model output is validated with zod; skipped ids stay pending. Video text is quoted as JSON and the system prompt forbids following instructions inside it.
  - LiteRT-LM runs in Firefox's background event page and in Chromium's offscreen page (the service worker has no DOM). Only the JSPI + relaxed-SIMD wasm build ships (copied by `wxt.config.ts`), so engine resolution requires both features (Chromium 137+, Firefox 153+). Its model lives in our own CacheStorage bucket; the cache is the only source of truth for "downloaded".
- All UI is Svelte 5. In-page UI (content scripts, MAIN or ISOLATED world) is mounted with `mount()` and looks native to YouTube; Polymer elements may sit in Svelte templates with `.data` set from a MAIN-world `$effect`. The popup is Material 3 Expressive via `m3-svelte`. `FilterEditor.svelte` is shared by the popup and the in-page dialog, so it stays library-free and is themed only through its `--filter-editor-*` custom properties.
- Mutate YouTube's Polymer components through their model (`el.set("data.contents", ...)`, `.data = ...`), never through `innerHTML`.
- InnerTube shapes are modelled as zod schemas (optional fields, `looseObject` passthrough) and read only through those guards - never index into raw shapes.
- Section structure of the feed is read-only: only add or remove videos within a section - never create, move or reorder sections or their markers.
- A Short goes only into the Shorts shelf YouTube already put in the feed - never into the Latest band, and no shelf is ever created. www has it on the first page (a `richShelfRenderer`); m sends its `reelShelfRenderer` with a later page, which only the response hook reaches, since m's grid is not written live. Shelf Shorts carry no publish time, so semi-sub Shorts lead the shelf newest first, before every Short YouTube put there, held to the band's loaded span (or the last 24 hours when no time can be read).
- **Pairing with YouTube Auto Feed** (`avi12/youtube-auto-feed`, "ytaf"): ytaf rewrites the feed grid from YouTube's own `FEsubscriptions` `/browse` response every 5 s and removes anything not in it. So semi-sub videos are injected into the *response* (hooked below every `fetch` wrapper), which makes ytaf keep and animate them itself. The extension must work in all three setups - without ytaf, with ytaf running, and with ytaf installed but switched off in its popup - and a change is verified in all three. ytaf runs when it is installed (`globalThis.__ytafFeedMessenger`) *and* switched on: `isYouTubeAutoFeedActive()` in `#feed/live/ytaf` overhears its `ytaf-settings` custom events, read-only (never register a messenger in its namespace: it would answer ytaf's own requests). While ytaf runs, never write the grid or handle tile menus - nudge it to refetch with `BroadcastChannel("ytaf")` `{ type: "subscription-change" }`, which is also done right after any hide-filter edit, mode switch or extension switch; otherwise the grid is ours to write, exactly as without ytaf. The contract both extensions keep (ytaf's side is in its own CLAUDE.md):
  - Grid and menu ownership move together: whoever writes `ytd-rich-grid-renderer` `data.contents` also keeps an open tile menu with its video (`#feed/live/open-menu`), and the other side stands down. Both flip on the same `settingsChanged` event.
  - The shared `tp-yt-iron-dropdown` is left clean at rest: no inline `translate`, no `yss-feed-gliding` class - ytaf reads either as a glide in flight.
  - A tile menu is identified by its video id (from the tile's Polymer data) and its button's `aria-label`: built tiles keep their video id in the lockup/renderer data, and menu additions (Semi-unsubscribe) go into the menu data, never as another tile button.
  - Every item semi-sub injects - in the Latest band and in the Shorts shelf alike - is tagged `yssSemiSubscribed: true`, beside `content` inside its `richItemRenderer` (m's reel shelf lists bare lockups: there the tag sits beside `shortsLockupViewModel`). The key lives in `#feed/compose/semi-subscribed-tag`. A subscribed channel injects nothing, so nothing of it is tagged.
  - Injection is consistent: every `FEsubscriptions` first-page `/browse` read, ytaf's 5 s polls included, carries the same semi-sub items, since ytaf treats a tagged item that a response no longer lists as removed. A built Short has a real video id at `onTap.innertubeCommand.reelWatchEndpoint.videoId`, and fills `overlayMetadata.primaryText`/`secondaryText` and the thumbnail sources ytaf reads.
  - Shorts are gated on ytaf's contract version, announced as `globalThis.__ytafHonorsSemiSubTags` (absent = 0, `true` = 1, otherwise the number), which `readYouTubeAutoFeedContractVersion()` in `#feed/live/ytaf` reads (`YtafContractVersion`): while ytaf runs, Shorts are injected only from version 1 (`honorsSemiSubTags`, `isShortsInjectionAllowed()`). An older ytaf never adopts new shelf items and prunes shelf Shorts from channels outside the guide's subscriptions, so they would only flash in and out. Regular band videos are not gated.
  - Hidden videos are listed from contract version 2 (`dropsHiddenVideos`, `isHiddenVideoListHonored()`): a first page lists every video the hide filters hide as `richGridRenderer.yssHiddenVideoIds: string[]` (on `tabRenderer.content.richGridRenderer`, beside the contents they were taken out of): those it held, and every cached upload they hide even when this page lacks it, since a poll's Shorts shelf rarely repeats the first load's. ytaf removes listed ids at once with its own animation - from the Latest band and every rich shelf - and never adds a listed id. The list is written only when non-empty.
  - Known edges, documented not fixed: an un-hidden native Short stays hidden until a reload while ytaf runs, since ytaf never adopts untagged shelf items. Without ytaf (or with it off), any un-hidden video returns on the next feed load, as the live grid never rebuilds YouTube's own items. Without ytaf only the Latest band and the Shorts shelf lose hidden videos; ytaf drops them from every rich shelf (such as "Most relevant") too.

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
- On www.youtube.com `Element.prototype.getAnimations`/`animate` and the `Animation` globals are YouTube's Web Animations polyfill, blind to CSS motion: read motion through `document.getAnimations()` filtered by `effect.target`, and tell CSS animations and transitions apart by shape (`#feed/live/feed-motion`)
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
