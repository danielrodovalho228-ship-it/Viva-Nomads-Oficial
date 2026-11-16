/*
  E985 — o assistente não gravava a escolha por cartão feita logo depois de abrir o rascunho. Abrir o rascunho deixa o
  autosave "aguardando a base" (E516): o primeiro estado assentado vira a base e não é gravado, a menos que tenha havido
  edição real. Edição real era só input/change — e os cartões de escolha são BOTÕES (o clique não dispara nenhum dos
  dois). Escolher um cartão nos 2 s depois de abrir virava base e sumia. Correção: o clique num controle de escolha
  (role radio/checkbox/switch ou aria-pressed) também marca a edição.
  Roda: node --test src/lib/anuncio/e985-escolha-por-cartao.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { SELETOR_ESCOLHA, cliqueEhEscolha, decisaoAutosave } from "./salvo-fantasma.ts";

/** Elemento falso: `closest` responde se algum ancestral casa com um dos seletores dados. */
const el = (casa: string[]) => ({ closest: (s: string) => (s.split(",").some((x) => casa.includes(x.trim())) ? {} : null) });

test("E985 — clique em cartão/opção/interruptor é escolha; em botão comum ou fora, não", () => {
  for (const c of ['[role="radio"]', '[role="checkbox"]', '[role="switch"]', "[aria-pressed]"]) {
    assert.ok(SELETOR_ESCOLHA.includes(c), c);
    assert.equal(cliqueEhEscolha(el([c])), true, c);
  }
  assert.equal(cliqueEhEscolha(el([])), false);
  assert.equal(cliqueEhEscolha(null), false);
  assert.equal(cliqueEhEscolha({}), false);
});

test("E985 — com a escolha marcada como edição, o autosave grava mesmo aguardando a base", () => {
  assert.equal(decisaoAutosave({ aguardandoBase: true, editou: true, base: null, conteudo: "x" }), "edicao");
  assert.equal(decisaoAutosave({ aguardandoBase: true, editou: false, base: null, conteudo: "x" }), "base");
});

test("E985 — o assistente marca a edição no clique de escolha (além de input/change)", () => {
  const s = readFileSync("src/app/(dashboard)/dashboard/imoveis/novo/page.tsx", "utf8");
  assert.match(s, /onClickCapture=\{\(e\) => \{\s*if \(cliqueEhEscolha\(e\.target as Element\)\) editouRef\.current = true;\s*\}\}/);
});
