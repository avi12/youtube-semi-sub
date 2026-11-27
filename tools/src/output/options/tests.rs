use clap::Parser;

use super::*;

#[derive(Debug, Parser)]
struct Wrapper {
    #[command(flatten)]
    args: OptionArgs,
}

fn host(platform: OsPlatform, is_wsl: bool) -> HostEnvironment {
    HostEnvironment {
        platform,
        is_wsl,
        home: PathBuf::new(),
        local_app_data: PathBuf::new(),
        app_data: PathBuf::new(),
        lang: "en".to_owned(),
    }
}

fn resolve(arguments: &[&str], host: &HostEnvironment) -> Result<DevOptions> {
    let wrapper = Wrapper::try_parse_from(
        ["devtool", "--project-root", "/repo"]
            .into_iter()
            .chain(arguments.iter().copied()),
    )
    .map_err(|error| OutputError::Invalid(error.to_string()))?;
    resolve_options(&wrapper.args, host)
}

#[test]
fn chrome_defaults_follow_the_platform() -> Result<()> {
    let windows = resolve(&[], &host(OsPlatform::Windows, false))?;
    assert_eq!(windows.cdp_port, 9280);
    assert!(windows.profile_dir.ends_with("chrome-win32"));
    let wsl = resolve(&[], &host(OsPlatform::Linux, true))?;
    assert_eq!(wsl.cdp_port, 9281);
    assert!(wsl.profile_dir.ends_with("chrome-wsl"));
    Ok(())
}

#[test]
fn firefox_and_flags_override_the_defaults() -> Result<()> {
    let options = resolve(
        &["--firefox", "--cdp-port", "9300", "--profile-dir", "p"],
        &host(OsPlatform::Linux, false),
    )?;
    assert_eq!(options.cdp_port, 9300);
    assert_eq!(options.marionette_port, 2838);
    assert_eq!(options.browser(), BuildBrowser::Firefox);
    assert!(options.profile_dir.ends_with("p"));
    Ok(())
}

#[test]
fn a_zero_port_is_rejected() {
    assert!(resolve(&["--cdp-port", "0"], &host(OsPlatform::Windows, false)).is_err());
}
