// One-off local tool: rasterizes src/app/icon.svg into src/app/favicon.ico so the .ico fallback
// (which some browsers/OS icon caches prefer over the SVG <link rel="icon">) matches the actual
// site icon instead of leaving create-next-app's default favicon.ico in place. Not part of the
// app itself -- run manually with `node scripts/generate-favicon.js` after changing icon.svg.
const sharp = require("sharp");
const fs = require("node:fs");
const path = require("node:path");

const SIZES = [16, 32, 48];
const svgPath = path.join(__dirname, "..", "src", "app", "icon.svg");
const outPath = path.join(__dirname, "..", "src", "app", "favicon.ico");

async function main() {
  const svgBuffer = fs.readFileSync(svgPath);
  const pngBuffers = await Promise.all(
    SIZES.map((size) => sharp(svgBuffer).resize(size, size).png().toBuffer())
  );

  const headerSize = 6;
  const entrySize = 16;
  const dirSize = headerSize + entrySize * SIZES.length;

  const header = Buffer.alloc(headerSize);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: 1 = icon
  header.writeUInt16LE(SIZES.length, 4); // image count

  const entries = [];
  let offset = dirSize;
  for (let i = 0; i < SIZES.length; i++) {
    const size = SIZES[i];
    const png = pngBuffers[i];
    const entry = Buffer.alloc(entrySize);
    entry.writeUInt8(size >= 256 ? 0 : size, 0); // width
    entry.writeUInt8(size >= 256 ? 0 : size, 1); // height
    entry.writeUInt8(0, 2); // color palette count
    entry.writeUInt8(0, 3); // reserved
    entry.writeUInt16LE(1, 4); // color planes
    entry.writeUInt16LE(32, 6); // bits per pixel
    entry.writeUInt32LE(png.length, 8); // size of image data
    entry.writeUInt32LE(offset, 12); // offset of image data
    entries.push(entry);
    offset += png.length;
  }

  const ico = Buffer.concat([header, ...entries, ...pngBuffers]);
  fs.writeFileSync(outPath, ico);
  console.log(`Wrote ${outPath} (${ico.length} bytes, sizes: ${SIZES.join(", ")})`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
