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

## Releasing

1. Set the version in `package.json` and commit it
2. Tag the commit `v<version>` and push the tag

The [Release workflow](.github/workflows/release.yml) builds the extension, packs the zip and a CRX signed with the key in the `CHROME_CRX_PRIVATE_KEY` secret, and attaches both, plus `updates.xml`, to a new GitHub release. `pnpm release:package` does the packing step locally after `pnpm build` and `pnpm zip`, with `CHROME_CRX_PRIVATE_KEY_PATH` pointing at the key. The public half of that key is in `src/lib/release.ts`: it fixes the extension's ID, so never replace the key.

## License

By contributing you agree that your contribution is licensed under the [GNU General Public License v3.0](LICENSE), the same as the project.
