import { test } from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import { reconverterFotoParaWebp } from "./foto-reconversao.ts";
import { tipoRealFotoPorMagicBytes } from "./upload-limits.ts";

async function jpegComExif(largura = 800, altura = 600) {
  return sharp({ create: { width: largura, height: altura, channels: 3, background: "#336699" } })
    .withExif({ IFD0: { Copyright: "Dono Fulano", Artist: "Fulano de Tal" } })
    .jpeg()
    .toBuffer();
}

test("JPEG com EXIF: a foto salva é WebP e sem EXIF", async () => {
  const entrada = await jpegComExif();
  assert.ok((await sharp(entrada).metadata()).exif, "pré-condição: o JPEG de entrada tem EXIF");
  const saida = await reconverterFotoParaWebp(new Uint8Array(entrada));
  assert.ok(saida);
  assert.equal(tipoRealFotoPorMagicBytes(saida), "image/webp");
  const meta = await sharp(saida).metadata();
  assert.equal(meta.format, "webp");
  assert.equal(meta.exif, undefined);
});

test("foto muito grande é reduzida ao lado máximo, sem ampliar as pequenas", async () => {
  const grande = await reconverterFotoParaWebp(new Uint8Array(await jpegComExif(4000, 3000)));
  const g = await sharp(grande!).metadata();
  assert.equal(Math.max(g.width ?? 0, g.height ?? 0), 2560);
  const pequena = await reconverterFotoParaWebp(new Uint8Array(await jpegComExif(400, 300)));
  const p = await sharp(pequena!).metadata();
  assert.deepEqual([p.width, p.height], [400, 300]);
});

test("caso negativo: bytes com cabeçalho de JPEG mas sem imagem dentro → null (não vira foto falsa)", async () => {
  const falso = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0]);
  assert.equal(await reconverterFotoParaWebp(falso), null);
});

test("a rota /api/upload/foto grava só o WebP re-codificado (não os bytes originais)", async () => {
  const { readFileSync } = await import("node:fs");
  const rota = readFileSync(new URL("../app/api/upload/foto/route.ts", import.meta.url), "utf8");
  assert.match(rota, /reconverterFotoParaWebp\(bytes\)/);
  assert.match(rota, /upload\(path, webp, \{ contentType: "image\/webp"/);
  assert.doesNotMatch(rota, /upload\(path, bytes/);
});
