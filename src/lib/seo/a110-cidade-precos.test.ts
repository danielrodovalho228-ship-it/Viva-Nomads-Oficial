/*
  A-110 (RELATORIO-021) — o FAQ da cidade não manda para "Preços" enquanto /precos está suspensa (E563).
  Roda: node --test src/lib/seo/a110-cidade-precos.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { faqPageCidade, perguntasCidade } from "./anuncio-cidade.ts";

const taxa = (lista: { pergunta: string; resposta: string }[]) => lista.find((p) => p.pergunta === "Quanto custa anunciar?")!.resposta;

test("com a página de preços suspensa, a resposta aponta para Para proprietários (que tem a taxa)", () => {
  const r = taxa(perguntasCidade("Uberlândia", false));
  assert.doesNotMatch(r, /Preços/);
  assert.match(r, /Veja os detalhes em Para proprietários\.$/);
});

test("com a página de preços ligada, volta a apontar para Preços", () => {
  assert.match(taxa(perguntasCidade("Uberlândia", true)), /Veja os detalhes em Preços\.$/);
});

test("padrão = chave real (desligada sem NEXT_PUBLIC_PRECOS_VISIVEL): tela e FAQPage dizem o mesmo, sem Preços", () => {
  const faq = faqPageCidade("Uberlândia");
  const r = faq.mainEntity.find((q) => q.name === "Quanto custa anunciar?")!.acceptedAnswer.text;
  assert.equal(r, taxa(perguntasCidade("Uberlândia")));
  assert.doesNotMatch(r, /Preços/);
});
