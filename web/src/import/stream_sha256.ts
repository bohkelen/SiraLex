/**
 * Incremental SHA-256 over Blob streams for package integrity verification.
 */

import { sha256 } from "@noble/hashes/sha256";
import { bytesToHex } from "@noble/hashes/utils";

const READ_CHUNK_SIZE = 8192;

export type StreamSha256Result = {
  digest: string;
  byteLength: number;
};

export async function sha256BlobStream(blob: Blob): Promise<StreamSha256Result> {
  const hasher = sha256.create();
  let byteLength = 0;
  const reader = blob.stream().getReader();

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      const bytes = value instanceof Uint8Array ? value : new Uint8Array(value);
      if (bytes.byteLength === 0) {
        continue;
      }
      hasher.update(bytes);
      byteLength += bytes.byteLength;
    }
  } finally {
    reader.releaseLock();
  }

  return {
    digest: `sha256:${bytesToHex(hasher.digest())}`,
    byteLength,
  };
}

export { READ_CHUNK_SIZE };
