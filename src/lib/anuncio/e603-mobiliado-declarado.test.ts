/*
  E603: a prévia do cadastro e o cartão no tamanho real mostravam o chip "Mobiliado" sem o dono ter declarado nada —
  o cadastro nasce com "Mobiliado e equipado" ligado, e a declaração mora no Passo 6 (Regras). Agora o chip só aparece
  depois que o dono passou pelo Passo 6 (ou num anúncio já publicado, que já foi declarado).
  Roda: node --test src/lib/anuncio/e603-mobiliado-declarado.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { mobiliadoNaPrevia } from "./assistente-telas.ts";
import { ETAPA } from "./etapas-ids.ts";

test("E603: antes do Passo 6, o valor inicial não vira chip", () => {
  assert.equal(mobiliadoNaPrevia({ furnished: true, etapaMax: ETAPA.comodidades, editando: false }), false);
  assert.equal(mobiliadoNaPrevia({ furnished: true, etapaMax: ETAPA.tipo, editando: false }), false);
});

test("E603: no Passo 6 ou depois, o chip segue a declaração do dono", () => {
  assert.equal(mobiliadoNaPrevia({ furnished: true, etapaMax: ETAPA.regras, editando: false }), true);
  assert.equal(mobiliadoNaPrevia({ furnished: false, etapaMax: ETAPA.revisao, editando: false }), false);
});

test("E603: anúncio publicado em edição mostra o que já foi declarado", () => {
  assert.equal(mobiliadoNaPrevia({ furnished: true, etapaMax: 0, editando: true }), true);
});

test("E603: a prévia e o cartão no tamanho real usam a mesma regra", () => {
  const tela = readFileSync(new URL("../../app/(dashboard)/dashboard/imoveis/novo/page.tsx", import.meta.url), "utf8");
  assert.match(tela, /mobiliado=\{mobiliadoPrevia\}/);
  assert.match(tela, /furnished: mobiliadoDeclarado \? furnished : undefined,/);
  assert.match(tela, /const mobiliadoPrevia = mobiliadoNaPrevia\(/);
});
