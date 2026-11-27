# Contributing

## Quick start

Prerequisites: [Node](https://nodejs.org), [Bun](https://bun.com) 1.4.5 and a [Rust](https://rustup.rs) toolchain (the dev server).

```sh
bun install
bun run dev            # Chromium
bun run dev:firefox    # Firefox
bun run dev:android    # Firefox for Android, on a device or emulator over adb
```

`bun run dev` runs the Rust dev server: it builds the extension, opens one browser with it loaded and applies each save as the smallest update. The first run compiles the server, and on Chromium downloads Chrome for Testing into `.chrome-for-testing/`.

`bun run dev:android` needs [adb](https://developer.android.com/tools/adb) (on `PATH`, in `ANDROID_HOME` or in Android Studio's default SDK) and Firefox for Android with **Settings > Remote debugging via USB** turned on. It uses the only connected device, or the one `--android-serial` names; `--android-package` picks Beta (`org.mozilla.firefox_beta`) or Nightly (`org.mozilla.fenix`). The extension runs from a folder on the device that every build is copied into, so saves hot-swap there as on desktop. Stopping the server leaves Firefox running.

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

The [Release workflow](.github/workflows/release.yml) runs on a `v*` tag: it builds the zips of every store (with the source zips) and attaches them to a new GitHub release.

## License

By contributing you agree that your contribution is licensed under the [GNU General Public License v3.0](LICENSE), the same as the project.
