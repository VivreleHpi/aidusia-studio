// Genere un PNG 10x10 blanc valide (verifie via zlib/crc32), pour le smoke
// test OCR. Pas de dependance externe.
import { deflateSync } from "node:zlib";
import { writeFileSync } from "node:fs";

const width = 10;
const height = 10;

function crc32(buf) {
  let c;
  const table = [];
  for (let n = 0; n < 256; n++) {
    c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type, "ascii");
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(data.length, 0);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([lenBuf, typeBuf, data, crcBuf]);
}

const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(width, 0);
ihdr.writeUInt32BE(height, 4);
ihdr[8] = 8; // bit depth
ihdr[9] = 2; // color type RGB
ihdr[10] = 0;
ihdr[11] = 0;
ihdr[12] = 0;

const rowBytes = width * 3;
const raw = Buffer.alloc((rowBytes + 1) * height, 255); // blanc, filter byte 0 par ligne
for (let y = 0; y < height; y++) raw[y * (rowBytes + 1)] = 0;

const idatData = deflateSync(raw);

const png = Buffer.concat([
  signature,
  chunk("IHDR", ihdr),
  chunk("IDAT", idatData),
  chunk("IEND", Buffer.alloc(0)),
]);

writeFileSync("./ocr-smoke.png", png);
console.log("PNG genere:", png.length, "octets");
