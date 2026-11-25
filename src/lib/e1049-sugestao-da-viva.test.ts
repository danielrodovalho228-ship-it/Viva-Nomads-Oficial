/*
  E1049 — trava (decisão do coordenador, registada na lista-master): a linha derivada dos dados do anúncio passa a ler
  "Sugestão da Viva: Família · Executivo" e cada rótulo mostra o MOTIVO ao tocar/passar o rato (resumos em
  src/config/selos.ts). A função de cálculo (src/lib/ideal-para.ts) NÃO sai — decisão do Daniel de 22/10.
  - "Ideal para:" nunca aparece sozinho como título da linha;
  - cada rótulo expõe o motivo (title para o rato, aria-label e o texto ao tocar).
  Roda: node --test src/lib/e1049-sugestao-da-viva.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { idealParaComMotivo, idealParaRotulos, SUGESTAO_DA_VIVA } from "./ideal-para.ts";
import { IDEAL_PARA } from "../config/selos.ts";

const componente = readFileSync(new URL("../components/property/ideal-para.tsx", import.meta.url), "utf8");

const ANUNCIO = {
  workFeatures: [],
  internetTier: null,
  bedrooms: 2,
  furnished: true,
  amenities: ["Mobiliado completo"],
  petsAllowed: false,
} as unknown as Parameters<typeof idealParaRotulos>[0];

test("E1049 — o título da linha é \"Sugestão da Viva\"", () => {
  assert.equal(SUGESTAO_DA_VIVA, "Sugestão da Viva");
  assert.match(componente, /\{SUGESTAO_DA_VIVA\}:/);
  assert.doesNotMatch(componente, /Ideal para:/, '"Ideal para:" nunca aparece sozinho');
});

test("E1049 — cada rótulo vem com o seu motivo (o resumo de src/config/selos.ts)", () => {
  const itens = idealParaComMotivo(ANUNCIO);
  assert.deepEqual(itens.map((i) => i.nome), ["Família", "Executivo"]);
  assert.deepEqual(itens, [
    { id: "familia", nome: IDEAL_PARA.familia.nome, motivo: IDEAL_PARA.familia.resumo },
    { id: "executivo", nome: IDEAL_PARA.executivo.nome, motivo: IDEAL_PARA.executivo.resumo },
  ]);
  for (const i of itens) assert.ok(i.motivo.length > 0, `${i.nome} sem motivo`);
});

test("E1049 — a função de cálculo segue (decisão do Daniel de 22/10): mesmos rótulos, mesma ordem", () => {
  assert.deepEqual(idealParaRotulos(ANUNCIO), idealParaComMotivo(ANUNCIO).map((i) => i.nome));
});

test("E1049 — na tela, cada rótulo expõe o motivo ao passar o rato (title), ao leitor de tela (aria-label) e ao tocar", () => {
  assert.match(componente, /title=\{i\.motivo\}/);
  assert.match(componente, /aria-label=\{`\$\{i\.nome\}: \$\{i\.motivo\}`\}/);
  assert.match(componente, /aria-expanded=\{aberto === i\.id\}/);
  assert.match(componente, /data-testid="sugestao-motivo"/);
  assert.match(componente, /data-testid="ideal-para"/, "o testid da linha segue (specs t234/t237/t262/t275)");
});
