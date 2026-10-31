/**
 * A minimal ZIP writer (B3), used to put the JSON backup and the photo files in one downloadable archive.
 *
 * Why hand-written instead of a library: the archive only needs the **store** method, because every payload is either
 * already-compressed JPEG or small JSON. DEFLATE would spend CPU for no gain, and a full zip library would add weight to
 * the APK for a feature used once in a while (TASKS.md rule 5: no libraries without a concrete need).
 *
 * Format notes that matter for correctness:
 *  - all multi-byte integers are little-endian;
 *  - file names are UTF-8 with the language-encoding flag (bit 11) set, so Persian file names survive;
 *  - sizes and offsets must fit 32 bits: a 300-photo archive is far below that, but `MAX_ENTRIES_BYTES` guards it anyway.
 */

const MAX_TOTAL_BYTES = 0xffff_ff00; // 4 GB - a little, the 32-bit limit of this simple format

/** CRC-32 (IEEE 802.3) lookup table, built once. */
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[i] = c >>> 0;
  }
  return t;
})();

function crc32(bytes: Uint8Array) {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

export type ZipEntry = { name: string; data: Uint8Array };

/** `Blob` wants an ArrayBuffer-backed view; our arrays are always created fresh, so this is a narrowing, not a copy. */
const part = (u: Uint8Array): BlobPart => u.buffer.slice(u.byteOffset, u.byteOffset + u.byteLength) as ArrayBuffer;

type Built = { nameBytes: Uint8Array; data: Uint8Array; crc: number; offset: number };

/**
 * Builds a store-only ZIP. Returns a Blob so a large archive does not have to be copied into one giant string.
 */
export function makeZip(entries: ZipEntry[]): Blob {
  const enc = new TextEncoder();
  const built: Built[] = [];
  let offset = 0;

  const parts: BlobPart[] = [];
  for (const e of entries) {
    if (offset > MAX_TOTAL_BYTES) throw new Error('archive too large');
    const nameBytes = enc.encode(e.name);
    const crc = crc32(e.data);

    // local file header: 30 bytes + name
    const local = new Uint8Array(30 + nameBytes.length);
    const dv = new DataView(local.buffer);
    dv.setUint32(0, 0x04034b50, true); // signature "PK\3\4"
    dv.setUint16(4, 20, true); // version needed
    dv.setUint16(6, 0x0800, true); // UTF-8 name flag
    dv.setUint16(8, 0, true); // method 0 = store
    dv.setUint16(10, 0, true); // mod time (fixed: the archive is a backup, not a restore of mtimes)
    dv.setUint16(12, 0x21, true); // mod date (1980-01-01)
    dv.setUint32(14, crc, true);
    dv.setUint32(18, e.data.length, true); // compressed size = uncompressed for store
    dv.setUint32(22, e.data.length, true);
    dv.setUint16(26, nameBytes.length, true);
    dv.setUint16(28, 0, true); // extra field length
    local.set(nameBytes, 30);

    parts.push(part(local), part(e.data));
    built.push({ nameBytes, data: e.data, crc, offset });
    offset += local.length + e.data.length;
  }

  // central directory
  const centralStart = offset;
  let centralSize = 0;
  for (const b of built) {
    const cd = new Uint8Array(46 + b.nameBytes.length);
    const dv = new DataView(cd.buffer);
    dv.setUint32(0, 0x02014b50, true); // signature "PK\1\2"
    dv.setUint16(4, 20, true); // version made by
    dv.setUint16(6, 20, true); // version needed
    dv.setUint16(8, 0x0800, true); // UTF-8
    dv.setUint16(10, 0, true); // store
    dv.setUint16(12, 0, true); // time
    dv.setUint16(14, 0x21, true); // date
    dv.setUint32(16, b.crc, true);
    dv.setUint32(20, b.data.length, true);
    dv.setUint32(24, b.data.length, true);
    dv.setUint16(28, b.nameBytes.length, true);
    dv.setUint16(30, 0, true); // extra
    dv.setUint16(32, 0, true); // comment
    dv.setUint16(34, 0, true); // disk number
    dv.setUint16(36, 0, true); // internal attrs
    dv.setUint32(38, 0, true); // external attrs
    dv.setUint32(42, b.offset, true); // where the local header is
    cd.set(b.nameBytes, 46);
    parts.push(part(cd));
    centralSize += cd.length;
  }

  // end of central directory
  const end = new Uint8Array(22);
  const dv = new DataView(end.buffer);
  dv.setUint32(0, 0x06054b50, true); // signature "PK\5\6"
  dv.setUint16(4, 0, true); // this disk
  dv.setUint16(6, 0, true); // disk with central dir
  dv.setUint16(8, built.length, true);
  dv.setUint16(10, built.length, true);
  dv.setUint32(12, centralSize, true);
  dv.setUint32(16, centralStart, true);
  dv.setUint16(20, 0, true); // comment length
  parts.push(part(end));

  return new Blob(parts, { type: 'application/zip' });
}

/** Base64 -> bytes, for reading a photo file out of the Filesystem plugin. */
export function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** Bytes -> base64, chunked so a large array does not blow the argument limit. */
export function bytesToBase64(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i += 8192) bin += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return btoa(bin);
}

/**
 * Reads a store-only ZIP (the kind `makeZip` writes). A ZIP made elsewhere with DEFLATE is rejected with a clear error
 * rather than silently ignored, because this is only meant to read back our own backups.
 */
export function readZip(bytes: Uint8Array): ZipEntry[] {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  // find the end record by scanning back for its signature (the comment field is empty for our own archives)
  let eocd = -1;
  for (let i = bytes.length - 22; i >= 0 && i >= bytes.length - 22 - 0xffff; i--) {
    if (dv.getUint32(i, true) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error('not a zip');

  const count = dv.getUint16(eocd + 10, true);
  let ptr = dv.getUint32(eocd + 16, true);
  const dec = new TextDecoder();
  const out: ZipEntry[] = [];
  for (let n = 0; n < count; n++) {
    if (dv.getUint32(ptr, true) !== 0x02014b50) throw new Error('bad central directory');
    const method = dv.getUint16(ptr + 10, true);
    const compSize = dv.getUint32(ptr + 20, true);
    const nameLen = dv.getUint16(ptr + 28, true);
    const extraLen = dv.getUint16(ptr + 30, true);
    const commentLen = dv.getUint16(ptr + 32, true);
    const localOffset = dv.getUint32(ptr + 42, true);
    const name = dec.decode(bytes.subarray(ptr + 46, ptr + 46 + nameLen));
    if (method !== 0) throw new Error('compressed zip entries are not supported');

    // the local header repeats the name and optional extra field, so the data starts after both
    if (dv.getUint32(localOffset, true) !== 0x04034b50) throw new Error('bad local header');
    const lNameLen = dv.getUint16(localOffset + 26, true);
    const lExtraLen = dv.getUint16(localOffset + 28, true);
    const start = localOffset + 30 + lNameLen + lExtraLen;
    out.push({ name, data: bytes.slice(start, start + compSize) });
    ptr += 46 + nameLen + extraLen + commentLen;
  }
  return out;
}
