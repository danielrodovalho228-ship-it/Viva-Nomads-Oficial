/*
  E902: em /parceiros, o link "Ver os passos do credenciamento" (convite de Avaliação de imóveis no formulário Seja parceiro)
  levava a /dashboard/parceiro/avaliacao, área logada. Passa a apontar para a página pública de recrutamento,
  /parceiros/avaliadores (ROTA_RECRUTAMENTO). Roda: node --test src/lib/parceiros/e902-link-credenciamento.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { CONVITE_SEJA_PARCEIRO, HREF_PASSOS_CREDENCIAMENTO } from "./convite-avaliacao.ts";
import { ROTA_RECRUTAMENTO } from "../vistoria/entrada.ts";

const form = readFileSync(new URL("../../components/parceiros/seja-parceiro-form.tsx", import.meta.url), "utf8");
const bloco = form.slice(form.indexOf('data-testid="sp-convite-avaliacao"'), form.indexOf("</fieldset>", form.indexOf('data-testid="sp-convite-avaliacao"')));

test("E902: 'Ver os passos do credenciamento' aponta para /parceiros/avaliadores", () => {
  assert.equal(ROTA_RECRUTAMENTO, "/parceiros/avaliadores");
  assert.equal(CONVITE_SEJA_PARCEIRO.link, "Ver os passos do credenciamento");
  assert.equal(HREF_PASSOS_CREDENCIAMENTO, ROTA_RECRUTAMENTO);
  assert.match(bloco, /<Link href=\{HREF_PASSOS_CREDENCIAMENTO\}[^>]*>\s*\{CONVITE_SEJA_PARCEIRO\.link\}/);
  assert.doesNotMatch(bloco, /\/dashboard\/parceiro\/avaliacao/);
});

test("E902: o formulário é o de /parceiros", () => {
  assert.match(readFileSync(new URL("../../app/(public)/parceiros/page.tsx", import.meta.url), "utf8"), /SejaParceiroForm/);
});
