//! The JavaScript the dev server injects, as source text with `@@NAME@@` placeholders filled in.

use super::hmr_names::HMR_ENTRY_GLOBAL;
use serde_json::Value;

const RAN_CONTENT_SCRIPTS_GLOBAL: &str = "__devtoolRanContentScripts";
const GUARD_TEMPLATE: &str = "if (!(@@RAN@@ ??= new Set()).has(@@NAME@@)) {
@@RAN@@.add(@@NAME@@);
@@SOURCE@@
}
";

const LOADER_TEMPLATE: &str = r#"(async () => {
  const ancestors = globalThis.location.ancestorOrigins;
  const isInExtensionPage = self !== top && ancestors?.[ancestors.length - 1]?.startsWith("chrome-extension:");
  if (isInExtensionPage) {
    @@STATIC_SOURCE@@
    return;
  }

  const api = globalThis.browser ?? globalThis.chrome;
  const hmrUrl = path => api.runtime.getURL(path);
  globalThis.@@ENTRY_GLOBAL@@ = @@ENTRY@@;
  await import(hmrUrl(@@RUNTIME_PATH@@));
  const manifest = await (await fetch(hmrUrl(@@MANIFEST_PATH@@), { cache: "no-store" })).json();
  const entry = await import(hmrUrl(manifest.entries[@@ENTRY@@]) + "?t=" + Date.now());
  await entry.run();
})();
// @@HASH@@
"#;

fn literal(text: &str) -> String {
    Value::from(text).to_string()
}

fn fill(template: &str, replacements: &[(&str, String)]) -> String {
    let mut text = template.to_owned();
    for (name, value) in replacements {
        text = text.replace(&format!("@@{name}@@"), value);
    }
    text
}

/// Runs a content script at most once per world.
pub(crate) fn guard_run_once(name: &str, source: &str) -> String {
    fill(
        GUARD_TEMPLATE,
        &[
            (
                "RAN",
                format!("globalThis[{}]", literal(RAN_CONTENT_SCRIPTS_GLOBAL)),
            ),
            ("NAME", literal(name)),
            ("SOURCE", source.to_owned()),
        ],
    )
}

/// The loader that replaces a hot-swappable content script's bundle. A frame inside an extension
/// page (the offscreen document's `YouTube` iframe) cannot import the HMR modules, so it runs the
/// original bundle instead.
pub(crate) fn content_script_loader(
    entry_name: &str,
    runtime_path: &str,
    manifest_path: &str,
    static_source: &str,
    source_hash: &str,
) -> String {
    fill(
        LOADER_TEMPLATE,
        &[
            ("ENTRY_GLOBAL", HMR_ENTRY_GLOBAL.to_owned()),
            ("ENTRY", literal(entry_name)),
            ("RUNTIME_PATH", literal(runtime_path)),
            ("MANIFEST_PATH", literal(manifest_path)),
            ("STATIC_SOURCE", static_source.to_owned()),
            ("HASH", source_hash.to_owned()),
        ],
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn no_placeholder_survives() {
        let loader = content_script_loader(
            "youtube",
            "hmr/runtime.js",
            "hmr/manifest.json",
            "run();",
            "abc",
        );
        let sources = [guard_run_once("a.js", "run();"), loader];
        for source in sources {
            assert!(!source.contains("@@"), "{source}");
        }
    }

    #[test]
    fn the_guard_wraps_the_source() {
        let guarded = guard_run_once("a.js", "run();");
        assert!(guarded.starts_with(
            "if (!(globalThis[\"__devtoolRanContentScripts\"] ??= new Set()).has(\"a.js\")) {"
        ));
        assert!(guarded.contains("\nrun();\n}"));
    }
}
