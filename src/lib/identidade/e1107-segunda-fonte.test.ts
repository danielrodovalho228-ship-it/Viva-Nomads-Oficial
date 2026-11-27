/*
  E1107 (ORDEM-DUET-490; achados A1/A2 da auditoria da ORDEM-488): a segunda fonte de identidade sai. O selo
  "Proprietário verificado", lido de owner.verified (profiles.is_verified mapeado em data/properties.ts), aparecia no
  cartão de resultados e na fileira de selos da página do imóvel — ao lado do selo da fonte única no bloco do dono.
  Agora: o cartão de resultados não leva identidade (E899: só o essencial); a página do imóvel mostra a identidade
  UMA vez, no bloco do dono, pela fonte (E1105/E1106); data/properties.ts não mapeia is_verified para exibição (a fonte
  lê o insumo pelo caminho dela, estado-servidor.ts). Estende a guarda do E1106 a estas superfícies.
  Roda: node --test src/lib/identidade/e1107-segunda-fonte.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fonteSemComentarios as semComentarios } from "../fonte-sem-comentarios.ts";

const ler = (p: string) => readFileSync(p, "utf8");

test("E1107: o cartão de resultados não leva selo de identidade nem lê verified/is_verified", () => {
  const cartao = semComentarios(ler("src/components/property-card.tsx"));
  assert.doesNotMatch(cartao, /\bverificado:/, "selosDaFoto sem o símbolo de identidade");
  assert.doesNotMatch(cartao, /\.verified\b|is_verified/);
});

test("E1107: a fileira de selos da página do imóvel não leva identidade — o selo fica só no bloco do dono, pela fonte", () => {
  const pagina = semComentarios(ler("src/app/(public)/imoveis/[id]/property-detail.tsx"));
  assert.doesNotMatch(pagina, /\bverificado:/, "selosDaFoto sem o símbolo de identidade");
  assert.doesNotMatch(pagina, /\.verified\b|is_verified/);
  // O selo de identidade da página continua a ser o do bloco do dono (E1105/E1106), pela fonte.
  assert.match(ler("src/components/property/owner-card.tsx"), /const selo = seloDoDono\(property, proprietario\?\.identidadeConfirmada\);/);
});

test("E1107: data/properties.ts não mapeia is_verified para exibição (a fonte lê o insumo pelo caminho dela)", () => {
  const dados = semComentarios(ler("src/lib/data/properties.ts"));
  assert.doesNotMatch(dados, /is_verified|verified:|\bd\.verificado\b/);
  // O insumo continua lido onde deve: na fonte.
  assert.match(ler("src/lib/identidade/estado-servidor.ts"), /is_verified/);
});
