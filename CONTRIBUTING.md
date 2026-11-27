# Contributing

## Quick start

Prerequisites: [Node](https://nodejs.org), [Bun](https://bun.com) 1.4.5 and a [Rust](https://rustup.rs) toolchain (the dev server).

```sh
bun install
bun run dev            # Chromium
bun run dev:firefox    # Firefox
```

`bun run dev` runs the Rust dev server: it builds the extension, opens one browser with it loaded and applies each save as the smallest update. The first run compiles the server, and on Chromium downloads Chrome for Testing into `.chrome-for-testing/`.

[CLAUDE.md](CLAUDE.md) is the project's guide: what the extension does, how the layers fit together, the constraints the code keeps, and the code style. Read its Architecture and Constraints sections before a change that touches the feed, the channel button or the filters.

## Before you open a pull request

Run every gate; they must all pass:

```sh
bun run lint
bun run svelte:check
bun run compile
bun run test
bun run fallow
```

Keep each commit one self-contained change with a message saying what and why. Verify a feed change in all three setups it supports: without YouTube Auto Feed, with it running, and with it installed but switched off. Prefer Firefox when checking cross-browser behaviour, it is the strictest.

## Releasing

1. Set the version in `package.json` and commit it
2. Tag the commit `v<version>` and push the tag

The [Release workflow](.github/workflows/release.yml) builds the extension, packs the zip and a CRX signed with the key in the `CHROME_CRX_PRIVATE_KEY` secret, and attaches both, plus `updates.xml`, to a new GitHub release. `bun run release:package` does the packing step locally after `bun run build` and `bun run zip`, with `CHROME_CRX_PRIVATE_KEY_PATH` pointing at the key. The public half of that key is in `src/lib/release.ts`: it fixes the extension's ID, so never replace the key.

## License

By contributing you agree that your contribution is licensed under the [GNU General Public License v3.0](LICENSE), the same as the project.
