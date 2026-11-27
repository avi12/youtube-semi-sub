use super::*;

fn chunk(code: &str, dependencies: &[&str], is_svelte: bool) -> HmrChunk {
    HmrChunk {
        code: code.to_owned(),
        src_hash: short_hash(code.as_bytes()),
        is_svelte,
        is_vendor: false,
        dependencies: dependencies.iter().map(|name| (*name).to_owned()).collect(),
    }
}

fn sample() -> BTreeMap<String, HmrChunk> {
    BTreeMap::from([
        (
            "src/a.js".to_owned(),
            chunk(
                "import { b } from \"./b.js\";\nimport C from './C.svelte.js';",
                &["src/b.js", "src/C.svelte.js"],
                false,
            ),
        ),
        (
            "src/b.js".to_owned(),
            chunk("export const b = 1;", &[], false),
        ),
        (
            "src/C.svelte.js".to_owned(),
            chunk("export default 1;", &[], true),
        ),
    ])
}

#[test]
fn a_change_bubbles_through_plain_dependencies_only() {
    let before = compute_final_versions(&sample());
    let mut edited_plain = sample();
    edited_plain.insert(
        "src/b.js".to_owned(),
        chunk("export const b = 2;", &[], false),
    );
    let mut edited_component = sample();
    edited_component.insert(
        "src/C.svelte.js".to_owned(),
        chunk("export default 2;", &[], true),
    );
    let plain = compute_final_versions(&edited_plain);
    let component = compute_final_versions(&edited_component);
    assert_ne!(before.get("src/a.js"), plain.get("src/a.js"));
    assert_eq!(before.get("src/a.js"), component.get("src/a.js"));
}

#[test]
fn only_plain_relative_imports_are_stamped() {
    let chunks = sample();
    let versions = compute_final_versions(&chunks);
    let stamped = ImportStamper::new()
        .unwrap()
        .stamp("src/a.js", &chunks, &versions);
    let version = versions.get("src/b.js").unwrap();
    assert!(stamped.contains(&format!("from \"./b.js?v={version}\"")));
    assert!(stamped.contains("from './C.svelte.js';"));
}

#[test]
fn a_reverted_module_gets_a_url_it_never_had() {
    let mut served = ServedVersions::new();
    let mut url_of = |content: &str| {
        let versions = BTreeMap::from([("a.js".to_owned(), content.to_owned())]);
        served.refresh(versions).remove("a.js").unwrap()
    };
    let first = url_of("one");
    assert_eq!(url_of("one"), first);
    let edited = url_of("two");
    let reverted = url_of("one");
    assert_ne!(reverted, first);
    assert_ne!(reverted, edited);
}

#[test]
fn a_cycle_falls_back_to_the_modules_own_hash() {
    let chunks = BTreeMap::from([
        ("x.js".to_owned(), chunk("x", &["y.js"], false)),
        ("y.js".to_owned(), chunk("y", &["x.js"], false)),
    ]);
    assert_eq!(compute_final_versions(&chunks).len(), 2);
}

#[test]
fn paths_normalize_like_posix() {
    assert_eq!(normalize_posix("a/b/../c/./d.js"), "a/c/d.js");
    assert_eq!(normalize_posix("./x.js"), "x.js");
}
