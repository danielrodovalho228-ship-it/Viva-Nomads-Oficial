/*
  62-A, Parte 1, item 1: o convite em "Seja parceiro".
  Roda: node --test src/lib/parceiros/convite-avaliacao.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { CONVITE_SEJA_PARCEIRO } from "./convite-avaliacao.ts";

test("o convite diz que é credenciamento à parte e leva aos passos", () => {
  assert.equal(CONVITE_SEJA_PARCEIRO.titulo, "Avaliação de imóveis");
  assert.match(CONVITE_SEJA_PARCEIRO.texto, /^Credenciamento à parte/);
  assert.doesNotMatch(Object.values(CONVITE_SEJA_PARCEIRO).join(" "), /vistoria|inspe[çc][ãa]o|per[íi]cia|comiss/i);
  const form = readFileSync(new URL("../../components/parceiros/seja-parceiro-form.tsx", import.meta.url), "utf8");
  assert.match(form, /data-testid="sp-convite-avaliacao"/);
  assert.match(form, /href="\/dashboard\/parceiro\/avaliacao"/);
});
