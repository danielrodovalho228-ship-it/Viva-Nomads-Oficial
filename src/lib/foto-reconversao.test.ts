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

/* Prompt 58 — EXIF/GPS sai de qualquer imagem enviada (mesmo formato) e o hash perceptual é calculado no servidor. */
import { hashPerceptual, semMetadados } from "./foto-reconversao.ts";

async function comGps(formato: "jpeg" | "png") {
  const base = sharp({ create: { width: 400, height: 300, channels: 3, background: "#884422" } }).withExif({
    IFD0: { Artist: "Fulano de Tal" },
    IFD3: { GPSLatitudeRef: "S", GPSLatitude: "18/1 55/1 0/1", GPSLongitudeRef: "W", GPSLongitude: "48/1 16/1 0/1" },
  });
  return new Uint8Array(await (formato === "jpeg" ? base.jpeg() : base.png()).toBuffer());
}

test("58: semMetadados tira EXIF e GPS de JPEG e PNG e mantém o formato", async () => {
  for (const [formato, mime] of [["jpeg", "image/jpeg"], ["png", "image/png"]] as const) {
    const entrada = await comGps(formato);
    assert.ok((await sharp(entrada).metadata()).exif, `pré-condição: ${formato} com EXIF`);
    const saida = await semMetadados(entrada, mime);
    assert.ok(saida);
    const meta = await sharp(saida).metadata();
    assert.equal(meta.format, formato);
    assert.equal(meta.exif, undefined, `${formato} sem EXIF/GPS`);
  }
});

test("58: semMetadados deixa PDF igual e recusa imagem quebrada", async () => {
  const pdf = new TextEncoder().encode("%PDF-1.4\n%fim");
  assert.equal(await semMetadados(pdf, "application/pdf"), pdf);
  assert.equal(await semMetadados(new Uint8Array([0xff, 0xd8, 0xff, 0x00]), "image/jpeg"), null);
});

test("58: hash perceptual — 16 hex; a mesma foto recomprimida fica perto; outra foto fica longe", async () => {
  // Degradê: na metade de cima clareia para a direita e na de baixo escurece (o dHash compara vizinhos na linha).
  const listras = (inverte: boolean) =>
    sharp(
      Buffer.from(Array.from({ length: 64 * 64 }, (_, i) => {
        const x = i % 64;
        const sobe = Math.floor(i / 64) < 32 !== inverte;
        return sobe ? 20 + x * 3 : 220 - x * 3;
      })),
      { raw: { width: 64, height: 64, channels: 1 } },
    );
  const a = new Uint8Array(await listras(false).jpeg({ quality: 95 }).toBuffer());
  const a2 = new Uint8Array(await listras(false).webp({ quality: 40 }).toBuffer());
  const b = new Uint8Array(await listras(true).jpeg({ quality: 95 }).toBuffer());
  const [ha, ha2, hb] = await Promise.all([hashPerceptual(a), hashPerceptual(a2), hashPerceptual(b)]);
  for (const h of [ha, ha2, hb]) assert.match(h ?? "", /^[0-9a-f]{16}$/);
  const dist = (x: string, y: string) => [...x].reduce((n, c, i) => n + [...(parseInt(c, 16) ^ parseInt(y[i], 16)).toString(2)].filter((d) => d === "1").length, 0);
  assert.ok(dist(ha!, ha2!) <= 4, "recomprimida fica a poucos bits");
  assert.ok(dist(ha!, hb!) > 4, "outra imagem fica longe");
  assert.equal(await hashPerceptual(new Uint8Array([1, 2, 3])), null);
});
