# YouTube Semi-Subscribe

Follow a YouTube channel without getting all of it. A **Semi-subscribe** button sits next to YouTube's own Subscribe button. Pick a filter, and only that channel's videos that pass it show up in your subscriptions feed.

Works on `www.youtube.com` and `m.youtube.com`, in Chromium browsers (Chrome, Edge, Opera) and Firefox.

## Features
- **Semi-subscribe button** on every channel you aren't subscribed to. If you later subscribe for real, the semi-subscription goes away
- **Two kinds of filter**
  - **RegExp** - matched against each video's title, e.g. `/tutorial|deep dive/i`
  - **AI match** - describe what you want in plain words ("only phone reviews, not unboxings"), and a model on your device judges each video's title and description
- **Live preview** - while you edit a filter, you see which recent videos will land in your feed and which won't
- **Animated feed insertion** - matching videos slide into `/feed/subscriptions` in their place by upload time
- **Manage from anywhere** - the Semi-subscribe button, the Subscriptions section of the YouTube sidebar, `/feed/channels`, or the extension's popup

## AI match
AI match is off until you turn it on in the popup. Until then nothing AI runs and nothing is downloaded.

When it's on, the extension checks what your browser offers:
1. **Built-in AI** (the Prompt API, e.g. Gemini Nano in Chrome) when the browser has it
2. Otherwise **LiteRT-LM** running Gemma on your GPU through WebGPU. The model is downloaded once (about 1.9 GB) from Hugging Face and deleted when you turn AI match off

Either way, judging happens on your device: video titles and descriptions are never sent to a server. Each verdict is remembered per filter and video, so a video is judged once.

LiteRT-LM needs WebGPU and WebAssembly JSPI, which Firefox ships from version 153.

## Works with YouTube Auto Feed
If you also use [YouTube Auto Feed](https://github.com/avi12/youtube-auto-feed), the two cooperate: semi-subscribed videos are added to the feed data Auto Feed reads, so it keeps them and animates them like any other new video.

## Privacy
- The extension fetches each semi-subscribed channel's public RSS feed from `youtube.com` every 15 minutes
- Your semi-subscriptions and filters stay in your browser's extension storage
- No analytics, no accounts, no servers of its own

## Development
Requires [pnpm](https://pnpm.io).

```sh
pnpm install
pnpm dev              # Chromium, with hot reload
pnpm dev:firefox
pnpm build            # or build:firefox
pnpm zip              # or zip:firefox (also packs the sources)
```

Before committing, run the gates listed in [CLAUDE.md](CLAUDE.md#linting): `pnpm lint`, `pnpm stylelint`, `pnpm svelte:check`, `pnpm compile`, `pnpm test` and `pnpm fallow`.

Built with [WXT](https://wxt.dev), [wxt-module-layers](https://github.com/davestewart/wxt-module-layers), Svelte 5, [m3-svelte](https://github.com/KTibow/m3-svelte), zod and [@webext-core/messaging](https://webext-core.aklinker1.io/messaging/installation).

## License
Copyright 2026 [Avi](https://avi12.com). Licensed under the [Apache License 2.0](LICENSE).

If you distribute this extension or a work based on it, keep the attribution in [NOTICE](NOTICE): credit Avi (https://avi12.com) in your documentation and in any about or credits screen.
