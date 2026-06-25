/**
 * Strict STORED-only ZIP reader for `.siralex.zip` transport packages (package v1).
 *
 * Structural validation only — does not parse manifests or invoke install paths.
 */

export const BUNDLE_PACKAGE_FORMAT_VERSION = "siralex_bundle_package_v1" as const;

/** Parser implementation limits — not timeless bundle-size policy. */
export const BUNDLE_PACKAGE_V1_LIMITS = {
  maxArchiveBytes: 64 * 1024 * 1024,
  maxTotalUncompressedBytes: 80 * 1024 * 1024,
  maxEntryUncompressedBytes: 60 * 1024 * 1024,
  maxCompressionRatio: 100,
} as const;

export const REQUIRED_BUNDLE_PACKAGE_ENTRY_NAMES = [
  "bundle.manifest.json",
  "records.jsonl",
  "search_index.jsonl",
] as const;

export type RequiredBundlePackageEntryName = (typeof REQUIRED_BUNDLE_PACKAGE_ENTRY_NAMES)[number];

const REQUIRED_ENTRY_NAME_SET = new Set<string>(REQUIRED_BUNDLE_PACKAGE_ENTRY_NAMES);

const LOCAL_FILE_HEADER_SIGNATURE = 0x04034b50;
const CENTRAL_DIRECTORY_HEADER_SIGNATURE = 0x02014b50;
const END_OF_CENTRAL_DIRECTORY_SIGNATURE = 0x06054b50;

const ZIP64_EXTRA_FIELD_ID = 0x0001;

const GPBF_ENCRYPTED = 0x0001;
const GPBF_DATA_DESCRIPTOR = 0x0008;

const ZIP64_EOCD_TOTAL_ENTRIES_SENTINEL = 0xffff;
const ZIP64_EOCD_SIZE_SENTINEL = 0xffffffff;
const ZIP64_EOCD_OFFSET_SENTINEL = 0xffffffff;

const COMPRESSION_METHOD_STORE = 0;

const EOCD_MIN_SIZE = 22;
const EOCD_MAX_COMMENT_SEARCH = 65535 + EOCD_MIN_SIZE;

const LOCAL_FILE_HEADER_FIXED_SIZE = 30;
const CENTRAL_DIRECTORY_HEADER_FIXED_SIZE = 46;

export type BundlePackageMetadata = {
  packageFormatVersion: typeof BUNDLE_PACKAGE_FORMAT_VERSION;
  archiveByteLength: number;
  totalUncompressedBytes: number;
  entryByteLengths: Record<RequiredBundlePackageEntryName, number>;
};

export type OpenedStoredBundlePackage = {
  manifestBlob: Blob;
  recordsBlob: Blob;
  searchIndexBlob: Blob;
  packageMetadata: BundlePackageMetadata;
};

export class BundlePackageError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "BundlePackageError";
    this.code = code;
  }
}

type CentralDirectoryEntry = {
  fileName: string;
  compressionMethod: number;
  generalPurposeBitFlag: number;
  crc32: number;
  compressedSize: number;
  uncompressedSize: number;
  localHeaderOffset: number;
  extraFieldLength: number;
  fileCommentLength: number;
};

type ValidatedEntry = CentralDirectoryEntry & {
  dataOffset: number;
  dataLength: number;
  rangeStart: number;
  rangeEnd: number;
};

function readUint16LE(view: DataView, offset: number): number {
  return view.getUint16(offset, true);
}

function readUint32LE(view: DataView, offset: number): number {
  return view.getUint32(offset, true);
}

function decodeAsciiFileName(bytes: Uint8Array): string {
  for (let i = 0; i < bytes.length; i += 1) {
    if (bytes[i] > 0x7f) {
      throw new BundlePackageError("invalid_entry_name", "ZIP entry name must be ASCII");
    }
  }
  return new TextDecoder("ascii").decode(bytes);
}

function validateEntryPath(fileName: string): void {
  if (fileName.length === 0) {
    throw new BundlePackageError("invalid_entry_name", "ZIP entry name must not be empty");
  }
  if (
    fileName.includes("/") ||
    fileName.includes("\\") ||
    fileName.includes(":") ||
    fileName.startsWith("/") ||
    fileName.includes("..")
  ) {
    throw new BundlePackageError("invalid_entry_path", `Rejected ZIP entry path: ${fileName}`);
  }
  for (let i = 0; i < fileName.length; i += 1) {
    const code = fileName.charCodeAt(i);
    if (code > 0x7f) {
      throw new BundlePackageError("invalid_entry_name", "ZIP entry name must be ASCII");
    }
  }
}

function assertStoreMethod(method: number): void {
  if (method !== COMPRESSION_METHOD_STORE) {
    throw new BundlePackageError(
      "unsupported_compression",
      `Only STORED (method 0) entries are allowed, got method ${method}`,
    );
  }
}

function assertSupportedGeneralPurposeFlags(flags: number): void {
  if ((flags & GPBF_ENCRYPTED) !== 0) {
    throw new BundlePackageError("encrypted_entry", "Encrypted ZIP entries are not supported");
  }
  if ((flags & GPBF_DATA_DESCRIPTOR) !== 0) {
    throw new BundlePackageError("data_descriptor", "ZIP data-descriptor entries are not supported");
  }
  if (flags !== 0) {
    throw new BundlePackageError(
      "unsupported_general_purpose_flag",
      "Nonzero general-purpose bit flags are not supported",
    );
  }
}

function assertNoZip64Extra(extra: Uint8Array): void {
  let offset = 0;
  while (offset + 4 <= extra.length) {
    const headerId = readUint16LE(new DataView(extra.buffer, extra.byteOffset + offset, 4), 0);
    const dataSize = readUint16LE(new DataView(extra.buffer, extra.byteOffset + offset, 4), 2);
    if (headerId === ZIP64_EXTRA_FIELD_ID) {
      throw new BundlePackageError("zip64", "ZIP64 extra fields are not supported");
    }
    offset += 4 + dataSize;
    if (offset > extra.length) {
      throw new BundlePackageError("corrupt_extra_field", "ZIP extra field extends past declared length");
    }
  }
  if (offset !== extra.length) {
    throw new BundlePackageError("corrupt_extra_field", "ZIP extra field contains truncated trailing bytes");
  }
}

function assertSizeWithinPolicy(
  label: string,
  compressedSize: number,
  uncompressedSize: number,
): void {
  if (!Number.isInteger(compressedSize) || compressedSize < 0) {
    throw new BundlePackageError("invalid_size", `${label}: invalid compressed size`);
  }
  if (!Number.isInteger(uncompressedSize) || uncompressedSize < 0) {
    throw new BundlePackageError("invalid_size", `${label}: invalid uncompressed size`);
  }
  if (uncompressedSize > BUNDLE_PACKAGE_V1_LIMITS.maxEntryUncompressedBytes) {
    throw new BundlePackageError("entry_too_large", `${label}: entry exceeds max one-entry limit`);
  }
  if (compressedSize > 0 && uncompressedSize / compressedSize > BUNDLE_PACKAGE_V1_LIMITS.maxCompressionRatio) {
    throw new BundlePackageError("compression_ratio", `${label}: compression ratio exceeds policy limit`);
  }
}

async function readFileRange(file: File, start: number, length: number): Promise<ArrayBuffer> {
  if (length === 0) {
    return new ArrayBuffer(0);
  }
  if (start < 0 || start + length > file.size) {
    throw new BundlePackageError("range_out_of_bounds", "Requested ZIP byte range is outside the package file");
  }
  return file.slice(start, start + length).arrayBuffer();
}

function findEndOfCentralDirectory(view: DataView, archiveSize: number): {
  eocdOffset: number;
  centralDirectorySize: number;
  centralDirectoryOffset: number;
  totalEntries: number;
} {
  const searchStart = Math.max(0, archiveSize - EOCD_MAX_COMMENT_SEARCH);
  const searchLength = archiveSize - searchStart;

  for (let offset = searchLength - EOCD_MIN_SIZE; offset >= 0; offset -= 1) {
    const absolute = searchStart + offset;
    if (readUint32LE(view, absolute) !== END_OF_CENTRAL_DIRECTORY_SIGNATURE) {
      continue;
    }

    const diskNumber = readUint16LE(view, absolute + 4);
    const centralDirectoryDisk = readUint16LE(view, absolute + 6);
    const entriesOnDisk = readUint16LE(view, absolute + 8);
    const totalEntries = readUint16LE(view, absolute + 10);
    const centralDirectorySize = readUint32LE(view, absolute + 12);
    const centralDirectoryOffset = readUint32LE(view, absolute + 16);
    const commentLength = readUint16LE(view, absolute + 20);

    if (commentLength !== 0) {
      throw new BundlePackageError("archive_comment", "ZIP archive comments are not supported");
    }
    if (diskNumber !== 0 || centralDirectoryDisk !== 0) {
      throw new BundlePackageError("multi_disk", "Multi-disk ZIP archives are not supported");
    }
    if (entriesOnDisk !== totalEntries) {
      throw new BundlePackageError("multi_disk", "Multi-disk ZIP entry counts are not supported");
    }
    if (
      totalEntries === ZIP64_EOCD_TOTAL_ENTRIES_SENTINEL ||
      centralDirectorySize === ZIP64_EOCD_SIZE_SENTINEL ||
      centralDirectoryOffset === ZIP64_EOCD_OFFSET_SENTINEL
    ) {
      throw new BundlePackageError("zip64", "ZIP64 EOCD markers are not supported");
    }
    if (absolute + EOCD_MIN_SIZE !== archiveSize) {
      throw new BundlePackageError("archive_comment", "Trailing bytes after EOCD are not allowed");
    }

    return {
      eocdOffset: absolute,
      centralDirectorySize,
      centralDirectoryOffset,
      totalEntries,
    };
  }

  throw new BundlePackageError("corrupt_eocd", "ZIP end-of-central-directory record not found");
}

function parseCentralDirectoryEntries(view: DataView, cdOffset: number, cdSize: number): CentralDirectoryEntry[] {
  const cdEnd = cdOffset + cdSize;
  if (cdOffset < 0 || cdEnd > view.byteLength) {
    throw new BundlePackageError("corrupt_central_directory", "Central directory range is out of bounds");
  }

  const entries: CentralDirectoryEntry[] = [];
  let offset = cdOffset;

  while (offset < cdEnd) {
    if (offset + CENTRAL_DIRECTORY_HEADER_FIXED_SIZE > cdEnd) {
      throw new BundlePackageError("corrupt_central_directory", "Central directory header truncated");
    }
    if (readUint32LE(view, offset) !== CENTRAL_DIRECTORY_HEADER_SIGNATURE) {
      throw new BundlePackageError("corrupt_central_directory", "Invalid central directory header signature");
    }

    const generalPurposeBitFlag = readUint16LE(view, offset + 8);
    const compressionMethod = readUint16LE(view, offset + 10);
    const crc32 = readUint32LE(view, offset + 16);
    const compressedSize = readUint32LE(view, offset + 20);
    const uncompressedSize = readUint32LE(view, offset + 24);
    const fileNameLength = readUint16LE(view, offset + 28);
    const extraFieldLength = readUint16LE(view, offset + 30);
    const fileCommentLength = readUint16LE(view, offset + 32);
    const diskNumberStart = readUint16LE(view, offset + 34);
    const localHeaderOffset = readUint32LE(view, offset + 42);

    if (compressedSize === 0xffffffff || uncompressedSize === 0xffffffff || localHeaderOffset === 0xffffffff) {
      throw new BundlePackageError("zip64", "ZIP64 size/offset markers are not supported");
    }
    if (diskNumberStart !== 0) {
      throw new BundlePackageError("multi_disk", "Multi-disk ZIP archives are not supported");
    }
    if (fileCommentLength !== 0) {
      throw new BundlePackageError("entry_comment", "Per-entry ZIP comments are not supported");
    }

    const nameStart = offset + CENTRAL_DIRECTORY_HEADER_FIXED_SIZE;
    const nameEnd = nameStart + fileNameLength;
    const extraStart = nameEnd;
    const extraEnd = extraStart + extraFieldLength;
    const entryEnd = extraEnd + fileCommentLength;

    if (entryEnd > cdEnd) {
      throw new BundlePackageError("corrupt_central_directory", "Central directory entry extends past directory end");
    }

    const fileName = decodeAsciiFileName(new Uint8Array(view.buffer, view.byteOffset + nameStart, fileNameLength));
    validateEntryPath(fileName);
    assertStoreMethod(compressionMethod);
    assertSupportedGeneralPurposeFlags(generalPurposeBitFlag);
    assertSizeWithinPolicy(fileName, compressedSize, uncompressedSize);

    if (extraFieldLength > 0) {
      assertNoZip64Extra(new Uint8Array(view.buffer, view.byteOffset + extraStart, extraFieldLength));
    }

    entries.push({
      fileName,
      compressionMethod,
      generalPurposeBitFlag,
      crc32,
      compressedSize,
      uncompressedSize,
      localHeaderOffset,
      extraFieldLength,
      fileCommentLength,
    });

    offset = entryEnd;
  }

  if (offset !== cdEnd) {
    throw new BundlePackageError("corrupt_central_directory", "Central directory contains trailing bytes");
  }

  return entries;
}

async function validateLocalHeaderAndDataRange(
  file: File,
  entry: CentralDirectoryEntry,
  centralDirectoryOffset: number,
): Promise<ValidatedEntry> {
  const headerBuffer = await readFileRange(file, entry.localHeaderOffset, LOCAL_FILE_HEADER_FIXED_SIZE);
  const headerView = new DataView(headerBuffer);

  if (readUint32LE(headerView, 0) !== LOCAL_FILE_HEADER_SIGNATURE) {
    throw new BundlePackageError("corrupt_local_header", `Invalid local header signature for ${entry.fileName}`);
  }

  const generalPurposeBitFlag = readUint16LE(headerView, 6);
  const compressionMethod = readUint16LE(headerView, 8);
  const crc32 = readUint32LE(headerView, 14);
  const compressedSize = readUint32LE(headerView, 18);
  const uncompressedSize = readUint32LE(headerView, 22);
  const fileNameLength = readUint16LE(headerView, 26);
  const extraFieldLength = readUint16LE(headerView, 28);

  if (compressedSize === 0xffffffff || uncompressedSize === 0xffffffff) {
    throw new BundlePackageError("zip64", "ZIP64 local header sizes are not supported");
  }

  const localVariableEnd =
    entry.localHeaderOffset + LOCAL_FILE_HEADER_FIXED_SIZE + fileNameLength + extraFieldLength;
  if (localVariableEnd > centralDirectoryOffset) {
    throw new BundlePackageError(
      "entry_range_overlaps_central_directory",
      `Entry ${entry.fileName} local filename/extra-field section overlaps the central directory`,
    );
  }

  const localNameBuffer = await readFileRange(
    file,
    entry.localHeaderOffset + LOCAL_FILE_HEADER_FIXED_SIZE,
    fileNameLength + extraFieldLength,
  );
  const localName = decodeAsciiFileName(new Uint8Array(localNameBuffer, 0, fileNameLength));

  if (localName !== entry.fileName) {
    throw new BundlePackageError(
      "local_central_mismatch",
      `Local/central filename mismatch for ${entry.fileName}`,
    );
  }
  if (compressionMethod !== entry.compressionMethod) {
    throw new BundlePackageError(
      "local_central_mismatch",
      `Local/central compression method mismatch for ${entry.fileName}`,
    );
  }
  if (generalPurposeBitFlag !== entry.generalPurposeBitFlag) {
    throw new BundlePackageError(
      "local_central_mismatch",
      `Local/central flags mismatch for ${entry.fileName}`,
    );
  }
  if (crc32 !== entry.crc32) {
    throw new BundlePackageError("local_central_mismatch", `Local/central CRC mismatch for ${entry.fileName}`);
  }
  if (compressedSize !== entry.compressedSize || uncompressedSize !== entry.uncompressedSize) {
    throw new BundlePackageError("local_central_mismatch", `Local/central size mismatch for ${entry.fileName}`);
  }

  assertStoreMethod(compressionMethod);
  assertSupportedGeneralPurposeFlags(generalPurposeBitFlag);

  if (extraFieldLength > 0) {
    assertNoZip64Extra(new Uint8Array(localNameBuffer, fileNameLength, extraFieldLength));
  }

  if (compressionMethod === COMPRESSION_METHOD_STORE && compressedSize !== uncompressedSize) {
    throw new BundlePackageError(
      "store_size_mismatch",
      `STORE entry ${entry.fileName} must have equal compressed and uncompressed sizes`,
    );
  }

  const rangeStart = entry.localHeaderOffset;
  const dataOffset = rangeStart + LOCAL_FILE_HEADER_FIXED_SIZE + fileNameLength + extraFieldLength;
  const dataEnd = dataOffset + compressedSize;

  if (rangeStart >= centralDirectoryOffset) {
    throw new BundlePackageError(
      "entry_range_overlaps_central_directory",
      `Entry ${entry.fileName} local header overlaps the central directory`,
    );
  }
  if (dataEnd > centralDirectoryOffset) {
    throw new BundlePackageError(
      "entry_range_overlaps_central_directory",
      `Entry ${entry.fileName} byte range overlaps the central directory`,
    );
  }
  if (dataEnd > file.size) {
    throw new BundlePackageError("local_header_out_of_range", `Payload for ${entry.fileName} extends past archive end`);
  }

  return {
    ...entry,
    dataOffset,
    dataLength: compressedSize,
    rangeStart,
    rangeEnd: dataEnd,
  };
}

function assertNoEntryRangeOverlap(entries: ValidatedEntry[]): void {
  const ranges = [...entries].sort((left, right) => left.rangeStart - right.rangeStart);
  for (let index = 1; index < ranges.length; index += 1) {
    const previous = ranges[index - 1]!;
    const current = ranges[index]!;
    if (current.rangeStart < previous.rangeEnd) {
      throw new BundlePackageError(
        "entry_range_overlap",
        `ZIP entry ranges overlap: ${previous.fileName} and ${current.fileName}`,
      );
    }
  }
}

function validateRequiredEntrySet(entries: ValidatedEntry[]): Map<RequiredBundlePackageEntryName, ValidatedEntry> {
  const byName = new Map<string, ValidatedEntry>();
  for (const entry of entries) {
    if (byName.has(entry.fileName)) {
      throw new BundlePackageError("duplicate_entry", `Duplicate ZIP entry name: ${entry.fileName}`);
    }
    byName.set(entry.fileName, entry);
  }

  for (const entry of entries) {
    if (!REQUIRED_ENTRY_NAME_SET.has(entry.fileName)) {
      throw new BundlePackageError("unexpected_entry", `Unexpected ZIP entry: ${entry.fileName}`);
    }
  }

  for (const requiredName of REQUIRED_BUNDLE_PACKAGE_ENTRY_NAMES) {
    if (!byName.has(requiredName)) {
      throw new BundlePackageError("missing_entry", `Missing required ZIP entry: ${requiredName}`);
    }
  }

  if (entries.length !== REQUIRED_BUNDLE_PACKAGE_ENTRY_NAMES.length) {
    throw new BundlePackageError(
      "entry_count",
      `Expected exactly ${REQUIRED_BUNDLE_PACKAGE_ENTRY_NAMES.length} ZIP entries, got ${entries.length}`,
    );
  }

  return byName as Map<RequiredBundlePackageEntryName, ValidatedEntry>;
}

function sliceEntryBlob(file: File, entry: ValidatedEntry, type: string): Blob {
  return file.slice(entry.dataOffset, entry.dataOffset + entry.dataLength, type);
}

/**
 * Open a `.siralex.zip` package and expose the three inner bundle payloads as Blobs.
 * Structural STORED-ZIP validation only.
 */
export async function openStoredBundlePackage(file: File): Promise<OpenedStoredBundlePackage> {
  if (!(file instanceof File)) {
    throw new BundlePackageError("invalid_input", "Package input must be a File");
  }
  if (file.size > BUNDLE_PACKAGE_V1_LIMITS.maxArchiveBytes) {
    throw new BundlePackageError("archive_too_large", "Package file exceeds max archive byte limit");
  }
  if (file.size < EOCD_MIN_SIZE + CENTRAL_DIRECTORY_HEADER_FIXED_SIZE) {
    throw new BundlePackageError("corrupt_eocd", "Package file is too small to be a valid ZIP archive");
  }

  const tailLength = Math.min(file.size, EOCD_MAX_COMMENT_SEARCH);
  const tailStart = file.size - tailLength;
  const tailBuffer = await readFileRange(file, tailStart, tailLength);
  const tailView = new DataView(tailBuffer);
  const eocd = findEndOfCentralDirectory(tailView, tailLength);
  const eocdAbsoluteOffset = tailStart + eocd.eocdOffset;

  if (
    eocd.centralDirectoryOffset < 0 ||
    eocd.centralDirectorySize < 0 ||
    eocd.centralDirectoryOffset + eocd.centralDirectorySize > file.size
  ) {
    throw new BundlePackageError("corrupt_central_directory", "Central directory range is outside archive bounds");
  }
  if (eocd.centralDirectoryOffset + eocd.centralDirectorySize !== eocdAbsoluteOffset) {
    throw new BundlePackageError(
      "central_directory_eocd_mismatch",
      "Central directory must occupy the byte range immediately preceding the EOCD",
    );
  }

  const cdBuffer = await readFileRange(file, eocd.centralDirectoryOffset, eocd.centralDirectorySize);
  const cdEntries = parseCentralDirectoryEntries(new DataView(cdBuffer), 0, eocd.centralDirectorySize);

  if (cdEntries.length !== eocd.totalEntries) {
    throw new BundlePackageError("corrupt_central_directory", "Central directory entry count disagrees with EOCD");
  }

  const validatedEntries: ValidatedEntry[] = [];
  for (const entry of cdEntries) {
    if (entry.localHeaderOffset < 0 || entry.localHeaderOffset >= file.size) {
      throw new BundlePackageError("local_header_out_of_range", `Local header offset out of range for ${entry.fileName}`);
    }
    validatedEntries.push(await validateLocalHeaderAndDataRange(file, entry, eocd.centralDirectoryOffset));
  }

  assertNoEntryRangeOverlap(validatedEntries);

  const byName = validateRequiredEntrySet(validatedEntries);

  let totalUncompressed = 0;
  const entryByteLengths = {} as Record<RequiredBundlePackageEntryName, number>;
  for (const requiredName of REQUIRED_BUNDLE_PACKAGE_ENTRY_NAMES) {
    const entry = byName.get(requiredName)!;
    totalUncompressed += entry.uncompressedSize;
    entryByteLengths[requiredName] = entry.uncompressedSize;
  }

  if (totalUncompressed > BUNDLE_PACKAGE_V1_LIMITS.maxTotalUncompressedBytes) {
    throw new BundlePackageError("total_uncompressed_too_large", "Total uncompressed payload exceeds policy limit");
  }

  const manifestEntry = byName.get("bundle.manifest.json")!;
  const recordsEntry = byName.get("records.jsonl")!;
  const searchIndexEntry = byName.get("search_index.jsonl")!;

  return {
    manifestBlob: sliceEntryBlob(file, manifestEntry, "application/json"),
    recordsBlob: sliceEntryBlob(file, recordsEntry, "application/x-ndjson"),
    searchIndexBlob: sliceEntryBlob(file, searchIndexEntry, "application/x-ndjson"),
    packageMetadata: {
      packageFormatVersion: BUNDLE_PACKAGE_FORMAT_VERSION,
      archiveByteLength: file.size,
      totalUncompressedBytes: totalUncompressed,
      entryByteLengths,
    },
  };
}
