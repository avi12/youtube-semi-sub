use super::*;

#[tokio::test]
async fn a_missing_manifest_snapshots_as_empty() -> Result<()> {
    let directory = std::env::temp_dir().join("devtool-workspace-missing");
    let workspace = DiskWorkspace::new(directory.clone(), directory.clone(), directory);
    let snapshot = workspace.script_snapshot().await?;
    assert!(snapshot.hashes.is_empty());
    assert_eq!(workspace.build_artifacts().await?, None);
    Ok(())
}

#[tokio::test]
async fn written_output_reads_back() -> Result<()> {
    let directory = std::env::temp_dir().join(format!("devtool-workspace-{}", std::process::id()));
    let workspace =
        DiskWorkspace::new(directory.clone(), directory.clone(), directory.join("lock"));
    workspace.write_output("img/a.png", b"x".to_vec()).await?;
    assert_eq!(
        workspace.read_output("img/a.png").await?,
        Some(b"x".to_vec())
    );
    assert_eq!(workspace.installed_lockfile_hash().await?, None);
    fs::remove_dir_all(directory)?;
    Ok(())
}
