/* Roda: node --test src/lib/anuncio/qualificacao-moldura.test.ts — E194 (a Qualificação dentro da moldura do assistente). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { progressoPasso, progressoQualificacao, textoQualificacao } from "./assistente-telas.ts";

test("a barra é contínua: sobe nas 5 telas e chega exatamente onde o Passo 1 começa", () => {
  const valores = [0, 1, 2, 3, 4, 5].map((t) => progressoQualificacao(t, 5, 10));
  for (let i = 1; i < valores.length; i++) assert.ok(valores[i] >= valores[i - 1]);
  assert.equal(valores[0], 0);
  assert.equal(valores[5], progressoPasso(0, 10));
  assert.equal(textoQualificacao(2), "Antes do Passo 1 · Qualificação 2 de 5");
});

test("a Qualificação usa o selo 'Anunciar imóvel' e o MESMO rodapé do assistente (sem moldura própria)", () => {
  const tela = readFileSync("src/app/(dashboard)/dashboard/imoveis/novo/qualificacao.tsx", "utf8");
  assert.match(tela, /data-testid="cadastro-modo"/);
  assert.match(tela, /Anunciar imóvel/);
  assert.match(tela, /<RodapeAssistente\b/);
  // A barra própria antiga (h-2 rounded-full bg-sage-100) saiu.
  assert.doesNotMatch(tela, /mx-auto mt-2 h-2 w-full max-w-md overflow-hidden rounded-full bg-sage-100/);
});
