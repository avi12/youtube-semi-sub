use super::*;

#[test]
fn subdomain_wildcard_matches_bare_and_nested_hosts() {
    let pattern = "*://*.youtube.com/*";
    assert!(matches_url_pattern(
        "https://youtube.com/watch?v=1",
        pattern
    ));
    assert!(matches_url_pattern("http://music.youtube.com/a", pattern));
    assert!(!matches_url_pattern("https://notyoutube.com/a", pattern));
    assert!(!matches_url_pattern("ftp://youtube.com/a", pattern));
}

#[test]
fn paths_and_all_urls() {
    assert!(matches_url_pattern(
        "https://a.com/x/y",
        "https://a.com/x/*"
    ));
    assert!(!matches_url_pattern("https://a.com/z", "https://a.com/x/*"));
    assert!(matches_url_pattern("anything", "<all_urls>"));
    assert!(!matches_url_pattern("anything", "nonsense"));
}

#[test]
fn content_scripts_get_names_and_defaults() -> Result<()> {
    let manifest = ExtensionManifest(serde_json::json!({
        "content_scripts": [
            {"js": ["content-scripts/youtube.js"], "world": "MAIN", "matches": ["*://*/*"]},
            {"js": ["a.js"], "css": ["a.css"], "all_frames": true}
        ],
        "background": {"service_worker": "bg.js"},
        "browser_specific_settings": {"gecko": {"id": "x@y"}}
    }));
    let entries = manifest.list_content_scripts()?;
    assert_eq!(
        entries.first().map(|entry| entry.names.clone()),
        Some(vec!["youtube".to_owned()])
    );
    assert!(entries
        .first()
        .is_some_and(ContentScriptEntry::is_main_world));
    assert_eq!(entries.get(1).map(|entry| entry.is_all_frames), Some(true));
    assert_eq!(manifest.background_files()?, vec!["bg.js".to_owned()]);
    assert_eq!(manifest.gecko_id(), "x@y");
    assert_eq!(describe_content_scripts(&entries), "youtube, a");
    Ok(())
}
