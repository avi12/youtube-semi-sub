# Contributing

## Quick start

Prerequisites: [Node](https://nodejs.org) and [pnpm](https://pnpm.io) (`corepack enable` is the easiest way to get it).

```sh
pnpm install
pnpm dev            # Chromium
pnpm dev:firefox    # Firefox
```

[CLAUDE.md](CLAUDE.md) is the project's guide: what the extension does, how the layers fit together, the constraints the code keeps, and the code style. Read its Architecture and Constraints sections before a change that touches the feed, the channel button or the filters.

## Before you open a pull request

Run every gate; they must all pass:

```sh
pnpm lint
pnpm svelte:check
pnpm compile
pnpm test
pnpm fallow
```

Keep each commit one self-contained change with a message saying what and why. Verify a feed change in all three setups it supports: without YouTube Auto Feed, with it running, and with it installed but switched off. Prefer Firefox when checking cross-browser behaviour, it is the strictest.

## License

By contributing you agree that your contribution is licensed under the [GNU General Public License v3.0](LICENSE), the same as the project.
