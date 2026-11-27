//! The smallest tar stream the device's own `tar -x` (toybox) reads: ustar headers for regular
//! files and the folders above them, in the order given, so the caller decides what lands last.

use std::collections::BTreeSet;

use super::{AndroidError, Result};

const BLOCK_SIZE: usize = 512;
const NAME_LENGTH: usize = 100;
const PREFIX_LENGTH: usize = 155;
const FILE_MODE: u32 = 0o644;
const FOLDER_MODE: u32 = 0o755;
const END_OF_ARCHIVE_BLOCKS: usize = 2;

/// Header field offsets and widths, per POSIX ustar.
const MODE_FIELD: (usize, usize) = (100, 8);
const OWNER_FIELD: (usize, usize) = (108, 8);
const GROUP_FIELD: (usize, usize) = (116, 8);
const SIZE_FIELD: (usize, usize) = (124, 12);
const MODIFIED_FIELD: (usize, usize) = (136, 12);
const CHECKSUM_FIELD: (usize, usize) = (148, 8);
const TYPE_OFFSET: usize = 156;
const MAGIC_FIELD: (usize, &[u8]) = (257, b"ustar\x0000");
const PREFIX_OFFSET: usize = 345;

/// The ustar type of an entry.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum EntryKind {
    File,
    Folder,
}

impl EntryKind {
    const fn type_flag(self) -> u8 {
        match self {
            Self::File => b'0',
            Self::Folder => b'5',
        }
    }

    const fn mode(self) -> u32 {
        match self {
            Self::File => FILE_MODE,
            Self::Folder => FOLDER_MODE,
        }
    }
}

/// One file of the archive: its `/`-separated relative path and its bytes.
#[derive(Debug, Clone, Copy)]
pub(super) struct TarFile<'a> {
    pub(super) path: &'a str,
    pub(super) bytes: &'a [u8],
}

type Block = [u8; BLOCK_SIZE];

/// Copies `bytes` into the header at `offset`.
fn put(header: &mut Block, offset: usize, bytes: &[u8]) -> Result<()> {
    header
        .get_mut(offset..offset + bytes.len())
        .ok_or_else(|| AndroidError::Device(format!("a tar field at {offset} overflows")))?
        .copy_from_slice(bytes);
    Ok(())
}

/// Writes `value` as a NUL-terminated octal number filling the field.
fn write_octal(header: &mut Block, (offset, width): (usize, usize), value: u64) -> Result<()> {
    let digits = format!("{value:0width$o}\0", width = width - 1);
    put(header, offset, digits.as_bytes())
}

/// A path longer than the name field is split at a `/` into the prefix field and the name.
fn split_path(path: &str) -> Result<(&str, &str)> {
    if path.len() <= NAME_LENGTH {
        return Ok(("", path));
    }
    path.match_indices('/')
        .map(|(index, _)| (&path[..index], &path[index + 1..]))
        .find(|(prefix, name)| prefix.len() <= PREFIX_LENGTH && name.len() <= NAME_LENGTH)
        .ok_or_else(|| AndroidError::Device(format!("the path {path} is too long for tar")))
}

fn header(path: &str, kind: EntryKind, size: usize) -> Result<Block> {
    let (prefix, name) = split_path(path)?;
    let size = u64::try_from(size)
        .map_err(|_| AndroidError::Device(format!("{path} is too large for tar")))?;
    let mut header = [0_u8; BLOCK_SIZE];
    put(&mut header, 0, name.as_bytes())?;
    put(&mut header, PREFIX_OFFSET, prefix.as_bytes())?;
    write_octal(&mut header, MODE_FIELD, u64::from(kind.mode()))?;
    write_octal(&mut header, OWNER_FIELD, 0)?;
    write_octal(&mut header, GROUP_FIELD, 0)?;
    write_octal(&mut header, SIZE_FIELD, size)?;
    write_octal(&mut header, MODIFIED_FIELD, 0)?;
    put(&mut header, TYPE_OFFSET, &[kind.type_flag()])?;
    let (magic_offset, magic) = MAGIC_FIELD;
    put(&mut header, magic_offset, magic)?;
    // The checksum is taken with its own field read as spaces
    let (checksum_offset, checksum_width) = CHECKSUM_FIELD;
    put(&mut header, checksum_offset, &[b' '; CHECKSUM_FIELD.1])?;
    let checksum: u64 = header.iter().map(|&byte| u64::from(byte)).sum();
    write_octal(&mut header, (checksum_offset, checksum_width - 1), checksum)?;
    Ok(header)
}

/// Every folder above the files, parents first.
fn parent_folders<'a>(files: &[TarFile<'a>]) -> BTreeSet<&'a str> {
    files
        .iter()
        .flat_map(|file| {
            file.path
                .match_indices('/')
                .map(|(index, _)| &file.path[..index])
        })
        .collect()
}

/// The archive of `files`, written in the order given after the folders they need.
pub(super) fn archive(files: &[TarFile<'_>]) -> Result<Vec<u8>> {
    let mut bytes = Vec::new();
    for folder in parent_folders(files) {
        bytes.extend_from_slice(&header(&format!("{folder}/"), EntryKind::Folder, 0)?);
    }
    for file in files {
        bytes.extend_from_slice(&header(file.path, EntryKind::File, file.bytes.len())?);
        bytes.extend_from_slice(file.bytes);
        let padding = (BLOCK_SIZE - file.bytes.len() % BLOCK_SIZE) % BLOCK_SIZE;
        bytes.resize(bytes.len() + padding, 0);
    }
    bytes.resize(bytes.len() + END_OF_ARCHIVE_BLOCKS * BLOCK_SIZE, 0);
    Ok(bytes)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn field(header: &[u8], (offset, width): (usize, usize)) -> &str {
        std::str::from_utf8(&header[offset..offset + width])
            .unwrap()
            .trim_end_matches(['\0', ' '])
    }

    #[test]
    fn files_follow_their_folders_in_the_order_given() -> Result<()> {
        let bytes = archive(&[
            TarFile {
                path: "hmr/b.js",
                bytes: b"b",
            },
            TarFile {
                path: "hmr/manifest.json",
                bytes: b"{}",
            },
        ])?;
        let names: Vec<&str> = bytes
            .chunks(BLOCK_SIZE)
            .filter(|block| block[TYPE_OFFSET] == b'0' || block[TYPE_OFFSET] == b'5')
            .map(|block| field(block, (0, NAME_LENGTH)))
            .collect();
        assert_eq!(names, ["hmr/", "hmr/b.js", "hmr/manifest.json"]);
        assert_eq!(bytes.len() % BLOCK_SIZE, 0);
        Ok(())
    }

    #[test]
    fn a_header_carries_its_size_mode_and_checksum() -> Result<()> {
        let block = header("a.js", EntryKind::File, 513)?;
        assert_eq!(field(&block, SIZE_FIELD), "00000001001");
        assert_eq!(field(&block, MODE_FIELD), "0000644");
        let stored = u64::from_str_radix(field(&block, CHECKSUM_FIELD), 8).unwrap();
        let mut spaced = block;
        let (checksum_offset, checksum_width) = CHECKSUM_FIELD;
        spaced[checksum_offset..checksum_offset + checksum_width].fill(b' ');
        let expected: u64 = spaced.iter().map(|&byte| u64::from(byte)).sum();
        assert_eq!(stored, expected);
        Ok(())
    }

    #[test]
    fn a_long_path_is_split_into_the_prefix() -> Result<()> {
        let long = format!("{}/{}", "d".repeat(120), "f".repeat(20));
        assert_eq!(
            split_path(&long)?,
            ("d".repeat(120).as_str(), "f".repeat(20).as_str())
        );
        assert!(split_path(&"x".repeat(300)).is_err());
        Ok(())
    }
}
