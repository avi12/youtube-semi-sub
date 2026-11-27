//! `devtool`: the developer tooling of the `YouTube` Semi-Subscribe extension.
//!
//! Command families (`devtool <family> --help` lists each one):
//! - `dev`: the dev server, its browser targets and HMR build
//! - `release`: the signed CRX and its update manifest
//! - `output`: build output diffing, reload planning, manifest patching and the dev profile
//!
//! Exit codes: 0 on success, 1 when a command failed.

mod cdp;
mod dev;
mod error;
mod firefox;
mod output;
mod port;
mod process;
mod release;

use clap::{Parser, Subcommand};

#[derive(Debug, Parser)]
#[command(name = "devtool", version, about)]
struct Cli {
    #[command(subcommand)]
    group: Group,
}

#[derive(Debug, Subcommand)]
enum Group {
    /// Packing a release
    #[command(subcommand)]
    Release(release::Command),
    /// The dev server: launcher, browser targets, HMR build and in-browser payloads
    #[command(subcommand)]
    Dev(dev::Command),
    /// Build output diffing, reload planning and manifest patching
    #[command(subcommand)]
    Output(output::Command),
}

#[tokio::main]
async fn main() -> std::process::ExitCode {
    let cli = Cli::parse();
    let outcome = match cli.group {
        Group::Release(command) => release::run(command).await,
        Group::Dev(command) => dev::run(command).await,
        Group::Output(command) => output::run(command).await,
    };
    match outcome {
        Ok(()) => std::process::ExitCode::SUCCESS,
        Err(error) => {
            eprintln!("{error}");
            std::process::ExitCode::FAILURE
        }
    }
}
