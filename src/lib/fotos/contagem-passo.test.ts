/*
  E417 (D8) — "8 / 8 fotos" com "Faltam 8 fotos" ao mesmo tempo: o aviso do cartão sai da mesma conta do número.
  Roda: node --test src/lib/fotos/contagem-passo.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { estadoPassoFotos } from "./conteudo.ts";
import { TEXTO_TERMINANDO_ENVIO, avisoDaContagem } from "./contagem-passo.ts";

const ler = (p: string) => readFileSync(new URL(`../../../${p}`, import.meta.url), "utf8");
const fotos = (n: number) => Array.from({ length: n }, () => ({ conteudo: null }));

test("o caso do QA: lote de 8 enviado, galeria ainda vazia (conferência em andamento) → nunca 'Faltam 8'", () => {
  const passo = estadoPassoFotos(fotos(0));
  assert.equal(passo.trava, "faltam");
  assert.match(passo.mensagem!, /Faltam 8 fotos/);
  const aviso = avisoDaContagem(passo, 8, 8); // o número mostra 8 / 8
  assert.equal(aviso.trava, "enviando");
  assert.equal(aviso.mensagem, TEXTO_TERMINANDO_ENVIO);
  assert.doesNotMatch(aviso.mensagem!, /Falta/);
});

test("lote parcial: o 'faltam' usa a mesma conta do número (6 enviadas de 8 → faltam 2)", () => {
  const aviso = avisoDaContagem(estadoPassoFotos(fotos(0)), 6, 8);
  assert.deepEqual(aviso, { trava: "faltam", mensagem: "Faltam 2 fotos para continuar (mínimo de 8)." });
  assert.equal(avisoDaContagem(estadoPassoFotos(fotos(7)), 7, 8).mensagem, "Falta 1 foto para continuar (mínimo de 8).");
});

test("sem envio em andamento: igual à trava da página (os e2e t468/t523 seguem valendo)", () => {
  for (const n of [0, 2, 7]) {
    const passo = estadoPassoFotos(fotos(n));
    assert.deepEqual(avisoDaContagem(passo, n, 8), { trava: passo.trava, mensagem: passo.mensagem });
  }
  assert.deepEqual(avisoDaContagem(estadoPassoFotos(fotos(8)), 8, 8), { trava: null, mensagem: null });
  assert.deepEqual(avisoDaContagem(undefined, 3, 8), { trava: null, mensagem: null });
});

test("outras travas (foto sinalizada, principal, vídeo) passam como estão", () => {
  const sinalizada = estadoPassoFotos([...fotos(7), { conteudo: { naoImovel: true } as never }]);
  assert.equal(sinalizada.trava, "sinalizadas");
  const a = avisoDaContagem(sinalizada, 8, 8);
  assert.equal(a.trava, sinalizada.trava);
  assert.equal(a.mensagem, sinalizada.mensagem);
});

test("tela: o cartão usa avisoDaContagem com o número do cartão; o Continuar segue na trava da página", () => {
  const etapa = ler("src/app/(dashboard)/dashboard/imoveis/novo/etapa-fotos.tsx");
  assert.match(etapa, /const aviso = avisoDaContagem\(passoFotos, contadas, MIN_PHOTOS\);/);
  assert.match(etapa, /data-trava=\{aviso\.trava \?\? undefined\}/);
  assert.doesNotMatch(etapa, /\{passoFotos\.mensagem\}/);
  const pagina = ler("src/app/(dashboard)/dashboard/imoveis/novo/page.tsx");
  assert.match(pagina, /const passoFotos = estadoPassoFotos\(photos, videoArquivo \? videoConteudo : null\);/);
});
