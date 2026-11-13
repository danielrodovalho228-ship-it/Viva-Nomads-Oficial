/*
  E843 (Phoenix RELATORIO-016, A-03/A-29): o filtro "Pronto para Morar" conta 15, mas o texto da página só dizia "Pronto para
  morar" em 9 dos 15 exemplos — o destaque entrava por último e o corte em 3 o tirava sempre que havia saúde/educação/trabalho/
  internet/ar antes. Regra: com o selo, "Pronto para morar" tem lugar garantido entre os 3 destaques (no último lugar).
  Roda: node --test src/lib/anuncio/e843-pronto-destaque.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { MAX_DESTAQUES, destaquesDoImovel } from "./resumos-imovel.ts";
import { SAMPLE_PROPERTIES } from "../properties.ts";

test("todo exemplo com o selo diz 'Pronto para morar' nos destaques (o filtro e a página contam igual)", () => {
  const comSelo = SAMPLE_PROPERTIES.filter((p) => p.readyToLiveBadge);
  const semNoTexto = comSelo.filter((p) => !destaquesDoImovel(p).some((d) => d.chave === "pronto")).map((p) => p.id);
  assert.deepEqual(semNoTexto, []);
  for (const p of SAMPLE_PROPERTIES) assert.ok(destaquesDoImovel(p).length <= MAX_DESTAQUES, p.id);
});

test("sem o selo, nunca aparece 'Pronto para morar'", () => {
  for (const p of SAMPLE_PROPERTIES) {
    const d = destaquesDoImovel({ ...p, readyToLiveBadge: false });
    assert.ok(!d.some((x) => x.chave === "pronto"), p.id);
  }
});
