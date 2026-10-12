import { test } from "node:test";
import assert from "node:assert/strict";
import { tipoRealFotoPorMagicBytes } from "./upload-limits.ts";

const b = (...n: number[]) => new Uint8Array(n);
const txt = (s: string) => new TextEncoder().encode(s);

test("foto: JPEG, PNG e WebP verdadeiros passam", () => {
  assert.equal(tipoRealFotoPorMagicBytes(b(0xff, 0xd8, 0xff, 0xe0, 0, 0)), "image/jpeg");
  assert.equal(tipoRealFotoPorMagicBytes(b(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0)), "image/png");
  assert.equal(tipoRealFotoPorMagicBytes(txt("RIFF\0\0\0\0WEBPVP8 ")), "image/webp");
});

test("foto: executável MZ renomeado .jpg é recusado (F46)", () => {
  assert.equal(tipoRealFotoPorMagicBytes(b(0x4d, 0x5a, 0x90, 0, 3, 0, 0, 0, 4, 0, 0, 0)), null);
});

test("foto: SVG com script é recusado (F47)", () => {
  assert.equal(tipoRealFotoPorMagicBytes(txt('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>')), null);
});

test("foto: texto renomeado .png é recusado (F48)", () => {
  assert.equal(tipoRealFotoPorMagicBytes(txt("isto é só um texto")), null);
});

test("foto: RIFF que não é WebP (ex.: WAV) e PDF são recusados", () => {
  assert.equal(tipoRealFotoPorMagicBytes(txt("RIFF\0\0\0\0WAVEfmt ")), null);
  assert.equal(tipoRealFotoPorMagicBytes(txt("%PDF-1.7 ....")), null);
  assert.equal(tipoRealFotoPorMagicBytes(b()), null);
});
