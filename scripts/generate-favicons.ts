import fs from "fs";
import path from "path";
import sharp from "sharp";

async function createIco(pngBuffers: { size: number; buffer: Buffer }[]): Promise<Buffer> {
  const count = pngBuffers.length;
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type 1 = ICO
  header.writeUInt16LE(count, 4); // count

  const dirEntries: Buffer[] = [];
  let currentOffset = 6 + count * 16;

  for (const item of pngBuffers) {
    const entry = Buffer.alloc(16);
    const s = item.size >= 256 ? 0 : item.size;
    entry.writeUInt8(s, 0); // width
    entry.writeUInt8(s, 1); // height
    entry.writeUInt8(0, 2); // color count
    entry.writeUInt8(0, 3); // reserved
    entry.writeUInt16LE(1, 4); // color planes
    entry.writeUInt16LE(32, 6); // bits per pixel
    entry.writeUInt32LE(item.buffer.length, 8); // size of image in bytes
    entry.writeUInt32LE(currentOffset, 12); // offset of image data

    dirEntries.push(entry);
    currentOffset += item.buffer.length;
  }

  return Buffer.concat([header, ...dirEntries, ...pngBuffers.map((b) => b.buffer)]);
}

async function main() {
  const srcImage = path.join(process.cwd(), "public", "gocab-official-logo.png");
  console.log("Reading source logo from:", srcImage);

  const sizes = [16, 32, 48, 256];
  const pngBuffers: { size: number; buffer: Buffer }[] = [];

  for (const size of sizes) {
    const buf = await sharp(srcImage)
      .resize(size, size, {
        fit: "contain",
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .png()
      .toBuffer();
    pngBuffers.push({ size, buffer: buf });
    console.log(`Generated ${size}x${size} PNG buffer (${buf.length} bytes)`);
  }

  const icoBuffer = await createIco(pngBuffers);
  console.log(`Assembled multi-resolution ICO (${icoBuffer.length} bytes)`);

  // Write to src/app/favicon.ico
  fs.writeFileSync(path.join(process.cwd(), "src", "app", "favicon.ico"), icoBuffer);
  console.log("✅ Wrote src/app/favicon.ico");

  // Write to public/favicon.ico
  fs.writeFileSync(path.join(process.cwd(), "public", "favicon.ico"), icoBuffer);
  console.log("✅ Wrote public/favicon.ico");

  // Write src/app/icon.png (32x32)
  const icon32 = await sharp(srcImage)
    .resize(32, 32, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
  fs.writeFileSync(path.join(process.cwd(), "src", "app", "icon.png"), icon32);
  console.log("✅ Wrote src/app/icon.png");

  // Write src/app/apple-icon.png (180x180)
  const appleIcon = await sharp(srcImage)
    .resize(180, 180, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
  fs.writeFileSync(path.join(process.cwd(), "src", "app", "apple-icon.png"), appleIcon);
  console.log("✅ Wrote src/app/apple-icon.png");

  // Write public/icon-192.png and public/icon-512.png
  const icon192 = await sharp(srcImage)
    .resize(192, 192, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
  fs.writeFileSync(path.join(process.cwd(), "public", "icon-192.png"), icon192);
  console.log("✅ Wrote public/icon-192.png");

  const icon512 = await sharp(srcImage)
    .resize(512, 512, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
  fs.writeFileSync(path.join(process.cwd(), "public", "icon-512.png"), icon512);
  console.log("✅ Wrote public/icon-512.png");
}

main().catch(console.error);
