/* Roda: node --test src/lib/fotos/qualidade.test.ts */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  orientacao, caixaDeCorte, tamanhoFinal, avisosDaFoto, dHash, distanciaHash,
  assinaturaFoto, distanciaAssinatura, fotosRepetidas, reduzirCinza, LADO_ASSINATURA, LIMIAR_REPETIDA,
  nitidezLaplaciano, luminanciaMedia, paraCinza, fatorExposicao, fatorAplicado, MAX_FOTOS_POR_ANUNCIO,
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
  const outro = "0123456789abcdee"; // 1 bit de diferença (foto antiga, sem assinatura)
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

test("'usar original' não ajusta exposição, mas o normal ajusta (caminho passa pelo canvas)", () => {
  assert.equal(fatorAplicado(50, true), 1);
  assert.equal(fatorAplicado(230, true), 1);
  assert.equal(fatorAplicado(50), fatorExposicao(50));
  assert.ok(fatorAplicado(50) > 1);
});

/* Q6 (prompt 10): cena sintética de um quarto, para medir a assinatura sem depender de arquivo. */
function quarto(W: number, H: number, mesa = false): Float32Array {
  const g = new Float32Array(W * H);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      let v = 90 + 60 * (y / H);
      if (x > W * 0.1 && x < W * 0.25 && y < H * 0.45 && y > H * 0.08) v = 220; // janela
      if (x > W * 0.35 && x < W * 0.8 && y > H * 0.55 && y < H * 0.85) v = 200; // cama
      if (x > W * 0.35 && x < W * 0.8 && y > H * 0.4 && y <= H * 0.55) v = 60; // cabeceira
      if (x > W * 0.85 && x < W * 0.97 && y > H * 0.3 && y < H * 0.9) v = 40; // armário
      if (mesa && x > W * 0.02 && x < W * 0.2 && y > H * 0.6 && y < H * 0.75) v = 150; // mesa
      g[y * W + x] = v;
    }
  return g;
}
function recorte(g: Float32Array, W: number, x0: number, y0: number, w: number, h: number, ruido = 0): Float32Array {
  const o = new Float32Array(w * h);
  let semente = 7;
  const aleatorio = () => ((semente = (semente * 16807) % 2147483647) / 2147483647) * 2 - 1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) o[y * w + x] = g[(y + y0) * W + x + x0] + aleatorio() * ruido;
  return o;
}
const ass = (g: Float32Array, w: number, h: number) => assinaturaFoto(reduzirCinza(g, w, h, LADO_ASSINATURA, LADO_ASSINATURA));

test("Q6: dois ângulos do mesmo quarto (cama × cama com mesa) NÃO são repetidos; a mesma foto recortada/comprimida é", () => {
  const cena = quarto(800, 400);
  const cenaComMesa = quarto(800, 400, true);
  const angulo1 = recorte(cena, 800, 0, 0, 600, 400);
  const angulo2 = recorte(cenaComMesa, 800, 200, 0, 600, 400);
  const mesmaRecortada = recorte(cena, 800, 30, 20, 540, 360, 4);
  const mesmaComprimida = recorte(cena, 800, 0, 0, 600, 400, 6);
  const a1 = { hash: "", assinatura: ass(angulo1, 600, 400) };
  assert.equal(fotosRepetidas(a1, { assinatura: ass(angulo2, 600, 400) }), false);
  assert.ok(distanciaAssinatura(a1.assinatura, ass(angulo2, 600, 400)) > LIMIAR_REPETIDA * 2);
  assert.equal(fotosRepetidas(a1, { assinatura: ass(mesmaRecortada, 540, 360) }), true);
  assert.equal(fotosRepetidas(a1, { assinatura: ass(mesmaComprimida, 600, 400) }), true);
  // O aviso aponta QUAL foto é a parecida (o card mostra a miniatura dela).
  const aviso = avisosDaFoto({ ...boa, assinatura: a1.assinatura }, [{ id: "foto-2", assinatura: ass(mesmaRecortada, 540, 360) }]);
  assert.deepEqual(aviso.map((x) => [x.codigo, x.parecidaCom]), [["repetida", "foto-2"]]);
  assert.deepEqual(avisosDaFoto({ ...boa, assinatura: a1.assinatura }, [{ id: "foto-3", assinatura: ass(angulo2, 600, 400) }]), []);
});

test("assinatura: tamanho fixo e distância inválida = infinita", () => {
  assert.equal(ass(quarto(64, 48), 64, 48).length, LADO_ASSINATURA * LADO_ASSINATURA * 2);
  assert.equal(distanciaAssinatura("00", "0000"), Infinity);
  assert.equal(distanciaAssinatura(undefined, "00"), Infinity);
});
