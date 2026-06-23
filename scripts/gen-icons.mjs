/**
 * Gera todos os ícones de app/PWA a partir de assets/brand/icon-mark.svg (o "N"
 * da marca). Saída COMITADA no repo (não gerar em runtime):
 *   src/app/apple-icon.png  (180, opaco, fundo branco — conserta o iOS)
 *   src/app/favicon.ico     (16/32/48 a partir do mark)
 *   public/icon-192.png, icon-512.png
 *   public/icon-192-maskable.png, icon-512-maskable.png
 *
 * Uso: node scripts/gen-icons.mjs
 */
import sharp from "sharp";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const markSvg = readFileSync(join(root, "assets/brand/icon-mark.svg"), "utf8");
// Conteúdo interno do mark (defs + paths), sem o <svg> externo.
const markInner = markSvg.replace(/^[\s\S]*?<svg[^>]*>/, "").replace(/<\/svg>[\s\S]*$/, "");

/** Canvas quadrado opaco (fundo branco) com o mark centralizado e `padFrac` de respiro. */
function canvas(size, padFrac) {
  const pad = Math.round(size * padFrac);
  const inner = size - pad * 2;
  const scale = inner / 100;
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">` +
      `<rect width="${size}" height="${size}" fill="#ffffff"/>` +
      `<g transform="translate(${pad} ${pad}) scale(${scale})">${markInner}</g>` +
      `</svg>`
  );
}

/** PNG opaco (sem alpha — exigência do iOS para o apple-touch-icon). */
async function png(size, padFrac, out) {
  await sharp(canvas(size, padFrac))
    .flatten({ background: "#ffffff" })
    .png()
    .toFile(join(root, out));
  console.log("✓", out);
}

/** Empacota PNGs (Vista+ ICO embute PNG) num único .ico multi-tamanho. */
function pngsToIco(images) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);
  let offset = 6 + images.length * 16;
  const entries = [];
  const datas = [];
  for (const { size, buf } of images) {
    const e = Buffer.alloc(16);
    e.writeUInt8(size >= 256 ? 0 : size, 0);
    e.writeUInt8(size >= 256 ? 0 : size, 1);
    e.writeUInt16LE(1, 4); // planes
    e.writeUInt16LE(32, 6); // bits
    e.writeUInt32LE(buf.length, 8);
    e.writeUInt32LE(offset, 12);
    entries.push(e);
    datas.push(buf);
    offset += buf.length;
  }
  return Buffer.concat([header, ...entries, ...datas]);
}

async function main() {
  mkdirSync(join(root, "public"), { recursive: true });

  // App icon do iOS — opaco, fundo branco, ~14% de respiro.
  await png(180, 0.14, "src/app/apple-icon.png");

  // PWA normais.
  await png(192, 0.14, "public/icon-192.png");
  await png(512, 0.14, "public/icon-512.png");

  // PWA maskable — mais padding (área segura do recorte do Android).
  await png(192, 0.22, "public/icon-192-maskable.png");
  await png(512, 0.22, "public/icon-512-maskable.png");

  // favicon.ico multi-tamanho a partir do mark (pad menor p/ legibilidade em 16px).
  const ico = pngsToIco(
    await Promise.all(
      [16, 32, 48].map(async (s) => ({
        size: s,
        // Fundo branco mas com canal alpha (opaco) — o decoder de ICO do Next
        // exige PNG em RGBA.
        buf: await sharp(canvas(s, 0.06))
          .flatten({ background: "#ffffff" })
          .ensureAlpha()
          .png()
          .toBuffer(),
      }))
    )
  );
  writeFileSync(join(root, "src/app/favicon.ico"), ico);
  console.log("✓ src/app/favicon.ico");
}

main();
