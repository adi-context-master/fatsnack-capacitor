import sharp from "sharp";
import { readFileSync, writeFileSync } from "node:fs";
const svg = readFileSync(process.argv[2]);
const size = parseInt(process.argv[4] || "1024");
const buf = await sharp(svg, { density: 600 })
  .resize(size, size, {
    fit: "contain",
    background: { r: 0xfa, g: 0xbf, b: 0x2a, alpha: 1 }, // fat-snag yellow
  })
  .flatten({ background: { r: 0xfa, g: 0xbf, b: 0x2a, alpha: 1 } })
  .png()
  .toBuffer();
writeFileSync(process.argv[3], buf);
console.log("wrote", process.argv[3], buf.length, "bytes");
