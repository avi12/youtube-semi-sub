use clap::ValueEnum;

use super::*;

#[test]
fn one_browser_enum_serves_clap_serde_and_the_build_name() {
    let parsed = BuildBrowser::from_str("firefox", true).unwrap();
    assert_eq!(parsed, BuildBrowser::Firefox);
    assert_eq!(serde_json::to_string(&parsed).unwrap(), "\"firefox\"");
    assert_eq!(
        serde_json::from_str::<BuildBrowser>("\"chrome\"")
            .unwrap()
            .name(),
        "chrome"
    );
}
