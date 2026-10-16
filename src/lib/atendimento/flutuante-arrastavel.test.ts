import { test } from "node:test";
import assert from "node:assert/strict";
import { ehArraste, grudarNaBorda, gravarPosicao, lerPosicao, limitarBaixo, posicaoDuranteArraste, LIMIAR_ARRASTE_PX } from "./flutuante-arrastavel.ts";

const tela = { largura: 390, altura: 800 };
const botao = { largura: 160, altura: 48 };

test("a9982623: clique curto (até 6 px) abre; acima disso é arraste", () => {
  assert.equal(ehArraste(0, 0), false);
  assert.equal(ehArraste(3, 4), false); // 5 px
  assert.equal(ehArraste(LIMIAR_ARRASTE_PX, 0), false);
  assert.equal(ehArraste(5, 5), true); // ~7 px
});

test("a9982623: ao soltar gruda na borda lateral mais próxima e mantém a altura", () => {
  assert.deepEqual(grudarNaBorda(100, 300, tela, botao), { lado: "esq", baixo: 300 });
  assert.deepEqual(grudarNaBorda(300, 300, tela, botao), { lado: "dir", baixo: 300 });
});

test("a9982623: a altura fica dentro da tela (margem e áreas seguras)", () => {
  assert.equal(limitarBaixo(-50, tela, botao), 12);
  assert.equal(limitarBaixo(5000, tela, botao), 800 - 48 - 12);
  assert.equal(limitarBaixo(0, { ...tela, seguroBaixo: 34 }, botao), 46);
  assert.equal(limitarBaixo(NaN, tela, botao), 12);
});

test("a9982623: durante o arraste não sai da tela", () => {
  assert.deepEqual(posicaoDuranteArraste(-40, 100, tela, botao), { esquerda: 12, baixo: 100 });
  assert.deepEqual(posicaoDuranteArraste(999, 100, tela, botao), { esquerda: 390 - 160 - 12, baixo: 100 });
});

test("a9982623: posição salva — lê, grava e ignora lixo/ausência de storage", () => {
  const mem = new Map<string, string>();
  const st = { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v) };
  assert.equal(lerPosicao(st), null);
  assert.equal(gravarPosicao(st, { lado: "esq", baixo: 200 }), true);
  assert.deepEqual(lerPosicao(st), { lado: "esq", baixo: 200 });
  mem.set("vivanomads-viva-posicao", '{"lado":"meio","baixo":1}');
  assert.equal(lerPosicao(st), null);
  mem.set("vivanomads-viva-posicao", "{quebrado");
  assert.equal(lerPosicao(st), null);
  assert.equal(lerPosicao(null), null);
  assert.equal(gravarPosicao(null, { lado: "dir", baixo: 1 }), false);
  const quebrado = { getItem: () => { throw new Error("x"); }, setItem: () => { throw new Error("x"); } };
  assert.equal(lerPosicao(quebrado), null);
  assert.equal(gravarPosicao(quebrado, { lado: "dir", baixo: 1 }), false);
});
