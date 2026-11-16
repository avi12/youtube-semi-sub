import { spawnSync } from "node:child_process";
import { createHash, createPublicKey } from "node:crypto";
import { copyFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { CHROME_EXTENSION_PUBLIC_KEY, CHROME_UPDATE_MANIFEST_FILE, REPOSITORY_URL } from "#release";

// Packs what `pnpm build` and `pnpm zip` produced into the release: the CRX, signed with the release key, and the
// update manifest Chrome reads to find the next CRX. Run it after both, with CHROME_CRX_PRIVATE_KEY_PATH set

const REPO_ROOT = resolve(import.meta.dirname, "..");
const OUTPUT_DIR = resolve(REPO_ROOT, ".output");
const BUILD_DIR = resolve(OUTPUT_DIR, "chrome-mv3");
const RELEASE_TAG_ENV = "GITHUB_REF_NAME";
const KEY_PATH_ENV = "CHROME_CRX_PRIVATE_KEY_PATH";
const CHROME_BINARY_ENV = "CHROME_BIN";
const ID_BYTE_COUNT = 16;
const NIBBLE_BITS = 4;
const NIBBLE_MASK = 0xf;
const LETTER_A_CODE = "a".codePointAt(0) ?? 0;

const { version } = JSON.parse(readFileSync(resolve(REPO_ROOT, "package.json"), "utf-8"));
const RELEASE_TAG = `v${version}`;
const CRX_FILE_NAME = `youtube-semi-sub-${version}-chrome.crx`;
const crxPath = resolve(OUTPUT_DIR, CRX_FILE_NAME);
const zipPath = resolve(OUTPUT_DIR, `youtube-semi-sub-${version}-chrome.zip`);

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

/** Chrome's ID for a key: the first 16 bytes of its SHA-256, each nibble written as a letter from a to p */
function deriveExtensionId(publicKeyBase64: string) {
  const der = createPublicKey({
    key: Buffer.from(publicKeyBase64, "base64"),
    format: "der",
    type: "spki"
  }).export({
    format: "der",
    type: "spki"
  });
  const bytes = createHash("sha256").update(der).digest().subarray(0, ID_BYTE_COUNT);
  return Array.from(bytes, byte =>
    String.fromCodePoint(LETTER_A_CODE + (byte >> NIBBLE_BITS), LETTER_A_CODE + (byte & NIBBLE_MASK))
  ).join("");
}

function findChromeBinary() {
  const candidates = [
    process.env[CHROME_BINARY_ENV],
    "C:/Program Files/Google/Chrome/Application/chrome.exe",
    "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
    "/usr/bin/chromium"
  ];
  return candidates.find(path => path && existsSync(path));
}

function packCrx(privateKeyPath: string) {
  const chromeBinary = findChromeBinary();
  if (!chromeBinary) {
    fail(`No Chrome binary found to pack the CRX; install Chrome or set ${CHROME_BINARY_ENV}`);
  }

  const result = spawnSync(
    chromeBinary,
    [`--pack-extension=${BUILD_DIR}`, `--pack-extension-key=${resolve(privateKeyPath)}`, "--no-message-box"],
    { stdio: "inherit" }
  );
  const packedPath = `${BUILD_DIR}.crx`;
  const isPacked = result.status === 0 && existsSync(packedPath);
  if (!isPacked) {
    fail("Chrome could not pack the CRX");
  }

  copyFileSync(packedPath, crxPath);
}

function renderUpdateManifest() {
  const codebase = `${REPOSITORY_URL}/releases/download/${RELEASE_TAG}/${CRX_FILE_NAME}`;
  return `<?xml version="1.0" encoding="UTF-8"?>
<gupdate xmlns="http://www.google.com/update2/response" protocol="2.0">
  <app appid="${deriveExtensionId(CHROME_EXTENSION_PUBLIC_KEY)}">
    <updatecheck codebase="${codebase}" version="${version}" />
  </app>
</gupdate>
`;
}

const privateKeyPath = process.env[KEY_PATH_ENV];
if (!privateKeyPath || !existsSync(privateKeyPath)) {
  fail(`${KEY_PATH_ENV} must point at the release signing key`);
}

const pushedTag = process.env[RELEASE_TAG_ENV];
const IS_TAG_MISMATCHED = Boolean(pushedTag) && pushedTag !== RELEASE_TAG;
if (IS_TAG_MISMATCHED) {
  fail(`The tag ${pushedTag} does not match package.json's version, ${version}`);
}

const IS_BUILT = existsSync(BUILD_DIR) && existsSync(zipPath);
if (!IS_BUILT) {
  fail("Run `pnpm build` and `pnpm zip` first");
}

packCrx(privateKeyPath);
writeFileSync(resolve(OUTPUT_DIR, CHROME_UPDATE_MANIFEST_FILE), renderUpdateManifest());
console.log(`Packed ${CRX_FILE_NAME} and ${CHROME_UPDATE_MANIFEST_FILE} for ${RELEASE_TAG}`);
