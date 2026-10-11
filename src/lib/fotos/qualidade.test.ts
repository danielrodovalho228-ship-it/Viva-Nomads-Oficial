/* Roda: node --test src/lib/fotos/qualidade.test.ts */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  orientacao, caixaDeCorte, tamanhoFinal, avisosDaFoto, dHash, distanciaHash,
  nitidezLaplaciano, luminanciaMedia, paraCinza, fatorExposicao, MAX_FOTOS_POR_ANUNCIO,
  type Analise,
} from "./qualidade.ts";

const boa: Analise = { largura: 3000, altura: 2000, luminancia: 130, nitidez: 300, hash: "0123456789abcdef" };

test("aceita vertical e horizontal", () => {
  assert.equal(orientacao(4000, 3000), "horizontal");
  assert.equal(orientacao(3000, 4000), "vertical");
  assert.equal(orientacao(1000, 1000), "quadrada");
  assert.equal(orientacao(0, 0), "quadrada");
});

test("corte 4:3: horizontal 16:9 corta as laterais, vertical corta em cima/embaixo", () => {
  const h = caixaDeCorte(1920, 1080);
  assert.equal(h.altura, 1080);
  assert.equal(h.largura, 1440);
  assert.equal(h.x, 240);
  const v = caixaDeCorte(1080, 1920);
  assert.equal(v.largura, 1080);
  assert.equal(v.altura, 810);
  assert.ok(v.y > 0 && v.y < (1920 - 810) / 2, "vertical fica um pouco acima do centro");
  const ja = caixaDeCorte(1600, 1200);
  assert.deepEqual(ja, { x: 0, y: 0, largura: 1600, altura: 1200 });
  assert.deepEqual(caixaDeCorte(0, 10), { x: 0, y: 0, largura: 0, altura: 0 });
});

test("tamanho final reduz, mas nunca amplia", () => {
  assert.deepEqual(tamanhoFinal(4000, 3000), { largura: 1920, altura: 1440 });
  assert.deepEqual(tamanhoFinal(800, 600), { largura: 800, altura: 600 });
  assert.deepEqual(tamanhoFinal(0, 0), { largura: 0, altura: 0 });
});

test("foto boa não gera aviso", () => {
  assert.deepEqual(avisosDaFoto(boa), []);
});

test("avisa pequena (<1200 px), escura, estourada, tremida — com dica", () => {
  const cod = (a: Partial<Analise>) => avisosDaFoto({ ...boa, ...a }).map((x) => x.codigo);
  assert.deepEqual(cod({ largura: 1000, altura: 800 }), ["pequena"]);
  assert.deepEqual(cod({ largura: 1200, altura: 800 }), []);
  assert.deepEqual(cod({ luminancia: 40 }), ["escura"]);
  assert.deepEqual(cod({ luminancia: 230 }), ["estourada"]);
  assert.deepEqual(cod({ nitidez: 5 }), ["tremida"]);
  for (const a of avisosDaFoto({ ...boa, luminancia: 40, nitidez: 5 })) assert.ok(a.dica.length > 10);
});

test("avisa repetida só quando o hash é parecido com o de outra foto", () => {
  const outro = "0123456789abcdee"; // 1 bit de diferença
  assert.deepEqual(avisosDaFoto(boa, [outro]).map((x) => x.codigo), ["repetida"]);
  assert.deepEqual(avisosDaFoto(boa, ["fedcba9876543210"]), []);
});

test("distância de hash: igual 0, oposto 64, inválido 64", () => {
  assert.equal(distanciaHash("0000000000000000", "0000000000000000"), 0);
  assert.equal(distanciaHash("0000000000000000", "ffffffffffffffff"), 64);
  assert.equal(distanciaHash("abc", "0000000000000000"), 64);
});

test("dHash é estável e diferencia gradientes opostos", () => {
  const sobe = Array.from({ length: 72 }, (_, i) => i % 9);
  const desce = Array.from({ length: 72 }, (_, i) => 8 - (i % 9));
  assert.equal(dHash(sobe), dHash([...sobe]));
  assert.equal(distanciaHash(dHash(sobe), dHash(desce)), 64);
});

test("nitidez: imagem lisa ~0, imagem com bordas é bem maior", () => {
  const w = 16;
  const lisa = new Array(w * w).fill(100);
  const xadrez = Array.from({ length: w * w }, (_, i) => ((i % w) + Math.floor(i / w)) % 2 ? 255 : 0);
  assert.ok(nitidezLaplaciano(lisa, w, w) < 1);
  assert.ok(nitidezLaplaciano(xadrez, w, w) > 1000);
  assert.equal(nitidezLaplaciano([1, 2], 2, 1), 0);
});

test("luminância e cinza", () => {
  const rgba = new Uint8ClampedArray([255, 255, 255, 255, 0, 0, 0, 255]);
  const g = paraCinza(rgba, 2);
  assert.ok(Math.abs(luminanciaMedia(g) - 127.5) < 0.01);
  assert.equal(luminanciaMedia([]), 0);
});

test("exposição: clareia escura, escurece estourada, mantém normal, limitada a ±30%", () => {
  assert.ok(fatorExposicao(50) > 1 && fatorExposicao(50) <= 1.3);
  assert.equal(fatorExposicao(10), 1.3);
  assert.ok(fatorExposicao(230) < 1 && fatorExposicao(230) >= 0.8);
  assert.equal(fatorExposicao(130), 1);
  assert.equal(fatorExposicao(0), 1);
});

test("rolo da câmera: até 40 fotos", () => {
  assert.equal(MAX_FOTOS_POR_ANUNCIO, 40);
});
