/**
 * Browser mirror of api/bundle_builder/build_bundle.py compute_content_sha256().
 *
 * Uses observed payload digests and canonical JSON ordering — not manifest text.
 */

import { sha256 } from "@noble/hashes/sha256";
import { bytesToHex, utf8ToBytes } from "@noble/hashes/utils";

export type ContentSha256FileEntry = {
  path: string;
  byte_length: number;
  sha256: string;
};

function comparePathsOrdinally(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

export function computeContentSha256(filesList: ContentSha256FileEntry[]): string {
  const sorted = [...filesList].sort((left, right) => comparePathsOrdinally(left.path, right.path));
  const canonicalList = sorted.map((entry) => ({
    byte_length: entry.byte_length,
    path: entry.path,
    sha256: entry.sha256,
  }));
  const canonicalJson = JSON.stringify(canonicalList);
  const digest = sha256(utf8ToBytes(canonicalJson));
  return `sha256:${bytesToHex(digest)}`;
}
