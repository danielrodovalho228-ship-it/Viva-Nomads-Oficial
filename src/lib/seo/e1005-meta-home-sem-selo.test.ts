/*
  E1005 (pacote C2-HOME, decisão do Muse em 16/11, ronda 20:19): a meta-descrição da home dizia
  "Imóveis mobiliados e prontos para morar", que atribui a todos os imóveis o nome do selo Pronto para Morar
  (um selo que só alguns têm). Correção: texto genérico, sem o nome do selo.
  Roda: node --test src/lib/seo/e1005-meta-home-sem-selo.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { descricaoHome, LIMITE_META } from "./meta-descricao.ts";
import { SELOS } from "../../config/selos.ts";

test("E1005 — a meta-descrição da home não atribui o nome do selo Pronto para Morar a todos os imóveis", () => {
  const d = descricaoHome();
  const nomeSelo = SELOS.prontoParaMorar.nome.toLowerCase(); // "pronto para morar"
  assert.ok(!d.toLowerCase().includes(nomeSelo.replace("pronto", "prontos")), d);
  assert.ok(!d.toLowerCase().includes(nomeSelo), d);
});

test("E1005 — o texto novo continua genérico, com o prazo e dentro do limite", () => {
  const d = descricaoHome();
  assert.equal(
    d,
    "Imóveis mobiliados para morar por meses, em estadias de 30 a 180 dias. Contrato com validade jurídica e conversa registrada na plataforma.",
  );
  assert.ok(d.length <= LIMITE_META, String(d.length));
});
