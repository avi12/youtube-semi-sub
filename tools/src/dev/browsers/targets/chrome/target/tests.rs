use super::*;

#[test]
fn the_extension_id_is_the_url_host() {
    let target: CdpTarget = serde_json::from_value(serde_json::json!({
        "id": "1", "type": "service_worker",
        "url": "chrome-extension://abcdef/background.js",
        "webSocketDebuggerUrl": "ws://x"
    }))
    .unwrap();
    assert_eq!(extension_id_of(&target), Some("abcdef"));
    assert!(is_extension_service_worker(&target));
}

fn target(kind: &str, url: &str) -> CdpTarget {
    serde_json::from_value(serde_json::json!({
        "id": url, "type": kind, "url": url, "webSocketDebuggerUrl": "ws://x"
    }))
    .unwrap()
}

#[test]
fn the_id_comes_from_any_extension_target() {
    let targets = [
        target("page", "https://example.com/"),
        target("other", "chrome-extension://offscreenid/offscreen.html"),
        target(
            "service_worker",
            "chrome-extension://workerid/background.js",
        ),
    ];
    assert_eq!(first_extension_id(&targets), Some("offscreenid".to_owned()));
    assert_eq!(first_extension_id(&targets[..1]), None);
}

#[test]
fn a_sleeping_worker_is_not_a_worker_target() {
    let targets = [target("other", "chrome-extension://id/offscreen.html")];
    assert!(!targets.iter().any(is_extension_service_worker));
    let awake = [target(
        "service_worker",
        "chrome-extension://id/background.js",
    )];
    assert!(awake.iter().any(is_extension_service_worker));
}

#[test]
fn page_names_come_from_html_paths() {
    assert_eq!(
        page_name_of("chrome-extension://id/popup.html?x=1"),
        Some("popup")
    );
    assert_eq!(
        page_name_of("chrome-extension://id/sub/offscreen.html"),
        Some("offscreen")
    );
    assert_eq!(page_name_of("chrome-extension://id/background.js"), None);
    assert_eq!(page_name_of("https://example.com/popup.html"), None);
}
