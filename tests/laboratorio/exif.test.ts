import test from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import { jpegComGps, lerMetadados, problemaDeMetadado } from "../e2e/fixtures/exif.ts";

// O leitor de EXIF/GPS das specs (t85, t250, t73, t236 e t278) precisa acusar o que o celular grava e passar o que o
// servidor limpa; senão o teste de depósito vira verde sem conferir nada.
test("foto de teste: JPEG com EXIF e GPS é acusado", async () => {
  const m = lerMetadados(await jpegComGps(1));
  assert.deepEqual([m.formato, m.exif, m.gps], ["jpeg", true, true]);
  assert.match(problemaDeMetadado(m) ?? "", /GPS/);
});

test("recodificar sem metadado (o que o servidor deve fazer) deixa JPEG e WebP limpos", async () => {
  const comGps = await jpegComGps(2);
  for (const b of [await sharp(comGps).jpeg().toBuffer(), await sharp(comGps).webp().toBuffer()]) {
    const m = lerMetadados(b);
    assert.equal(problemaDeMetadado(m), null, `${m.formato} deveria sair limpo`);
  }
});

test("EXIF guardado em WebP e PNG também é acusado (só trocar o formato não limpa)", async () => {
  const comGps = await jpegComGps(3);
  const webp = lerMetadados(await sharp(comGps).keepExif().webp().toBuffer());
  assert.deepEqual([webp.formato, webp.exif, webp.gps], ["webp", true, true]);
  const png = lerMetadados(await sharp(comGps).keepExif().png().toBuffer());
  assert.deepEqual([png.formato, png.exif, png.gps], ["png", true, true]);
});

test("EXIF sem GPS reprova como EXIF; arquivo que não é imagem não quebra o leitor", async () => {
  const soCamera = await sharp({ create: { width: 8, height: 8, channels: 3, background: "#fff" } }).jpeg().withExif({ IFD0: { Make: "X" } }).toBuffer();
  const m = lerMetadados(soCamera);
  assert.deepEqual([m.exif, m.gps], [true, false]);
  assert.match(problemaDeMetadado(m) ?? "", /^EXIF/);
  assert.equal(problemaDeMetadado(lerMetadados(Buffer.from("%PDF-1.7 não é imagem"))), null);
});
