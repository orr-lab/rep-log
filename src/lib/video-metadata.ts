// Seconds between the ISO-BMFF (MP4/MOV) "Mac epoch" (1904-01-01T00:00:00Z) and the Unix epoch.
const MAC_EPOCH_OFFSET_SECONDS = 2082844800;

// Don't scan further than this looking for `moov` -- on a file where it wasn't found by then,
// treat it as unsupported/unavailable rather than reading an arbitrarily large upload just to
// look for metadata that may not even be there.
const READ_BUDGET_BYTES = 32 * 1024 * 1024;

/** Best-effort extraction of a video file's embedded recording date, by walking its ISO-BMFF
 *  (MP4/MOV -- the container almost every phone camera uses) box structure to find
 *  `moov > mvhd`'s `creation_time` field. Returns null for unsupported containers (e.g. WebM),
 *  files where `moov` wasn't found within the read budget, or anything that comes out looking
 *  implausible -- callers should treat this as a nice-to-have autofill, never a guarantee, and
 *  always leave the resulting date editable. */
export async function extractVideoCreationDate(file: File): Promise<Date | null> {
  try {
    let offset = 0;
    const limit = Math.min(file.size, READ_BUDGET_BYTES);

    while (offset + 8 <= limit) {
      const header = new DataView(await file.slice(offset, offset + 8).arrayBuffer());
      if (header.byteLength < 8) break;

      let boxSize = header.getUint32(0);
      const boxType = String.fromCharCode(
        header.getUint8(4),
        header.getUint8(5),
        header.getUint8(6),
        header.getUint8(7)
      );
      let headerSize = 8;

      if (boxSize === 1) {
        const ext = new DataView(await file.slice(offset + 8, offset + 16).arrayBuffer());
        if (ext.byteLength < 8) break;
        boxSize = ext.getUint32(0) * 2 ** 32 + ext.getUint32(4);
        headerSize = 16;
      } else if (boxSize === 0) {
        boxSize = file.size - offset;
      }

      if (!Number.isFinite(boxSize) || boxSize < headerSize) break;

      if (boxType === "moov") {
        return await findMvhdCreationDate(file, offset + headerSize, offset + boxSize);
      }

      offset += boxSize;
    }
  } catch {
    // Any read/parse failure just means no autofill -- never surface this to the user.
  }
  return null;
}

async function findMvhdCreationDate(file: File, start: number, end: number): Promise<Date | null> {
  let offset = start;
  while (offset + 8 <= end) {
    const header = new DataView(await file.slice(offset, offset + 8).arrayBuffer());
    if (header.byteLength < 8) break;

    const boxSize = header.getUint32(0);
    const boxType = String.fromCharCode(
      header.getUint8(4),
      header.getUint8(5),
      header.getUint8(6),
      header.getUint8(7)
    );
    if (!Number.isFinite(boxSize) || boxSize < 8) break;

    if (boxType === "mvhd") {
      const versionByte = new DataView(await file.slice(offset + 8, offset + 9).arrayBuffer());
      if (versionByte.byteLength < 1) return null;
      const version = versionByte.getUint8(0);
      const creationOffset = offset + 8 + 4; // past version(1) + flags(3)

      if (version === 1) {
        const view = new DataView(await file.slice(creationOffset, creationOffset + 8).arrayBuffer());
        if (view.byteLength < 8) return null;
        return macSecondsToDate(view.getUint32(0) * 2 ** 32 + view.getUint32(4));
      }
      const view = new DataView(await file.slice(creationOffset, creationOffset + 4).arrayBuffer());
      if (view.byteLength < 4) return null;
      return macSecondsToDate(view.getUint32(0));
    }

    offset += boxSize;
  }
  return null;
}

function macSecondsToDate(seconds: number): Date | null {
  if (!seconds) return null;
  const unixSeconds = seconds - MAC_EPOCH_OFFSET_SECONDS;
  if (unixSeconds <= 0) return null;

  const date = new Date(unixSeconds * 1000);
  // Reject anything implausible -- e.g. an encoder that wrote Unix-epoch seconds into this field
  // instead of Mac-epoch ones would land decades in the future after our offset subtraction.
  if (date.getFullYear() < 2000 || date.getTime() > Date.now() + 24 * 60 * 60 * 1000) return null;
  return date;
}
