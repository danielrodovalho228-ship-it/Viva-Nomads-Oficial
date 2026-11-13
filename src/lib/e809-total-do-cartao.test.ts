/*
  E809 — o total do CABEÇALHO de todo cartão sai da MESMA conta da composição ("Total da estadia: …").
  O relato (RELATORIO-011): um cartão "São José" dizia "R$ 3.300/mês · R$ 4.140 em 2 meses" com a composição
  "2 × R$ 3.300 + limpeza de preparação R$ 300 + limpeza de saída R$ 240" (= R$ 7.140). Conferido no dado-fonte: esse
  anúncio nunca existiu — nem no banco de produção, nem em src/, nem em nenhum commit (o mesmo conjunto fantasma do E810).
  A classe de erro já está fechada no código (E756/E777): cabeçalho e composição saem do MESMO objeto (estadiaNoCartao).
  Este teste prova isso para TODO cartão (15 exemplos × 1 a 6 meses) e para o caso relatado, montado com os números dele.
  Roda: node --test src/lib/e809-total-do-cartao.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { SAMPLE_PROPERTIES } from "./properties.ts";
import { estadiaNoCartao } from "./cartao-estadia.ts";
import { formatBRL } from "./utils.ts";

const NBSP = (s: string) => s.replace(/ /g, " ");
const reais = (s: string) => Number(s.replace(/[^\d,]/g, "").replace(",", "."));

/** Soma a composição escrita: "N × R$ X + rótulo R$ Y + …". */
function somaDaComposicao(composicao: string): number {
  const [primeira, ...resto] = NBSP(composicao).split(" + ");
  const m = /^(\d+) × (R\$ [\d.,]+)$/.exec(primeira);
  assert.ok(m, `primeira parcela: ${primeira}`);
  let total = Number(m[1]) * reais(m[2]);
  for (const p of resto) total += reais(/R\$ [\d.,]+$/.exec(p)![0]);
  return Math.round(total * 100) / 100;
}

test("todo cartão (15 exemplos × 1 a 6 meses): o total do cabeçalho = a soma da composição", () => {
  let cartoes = 0;
  for (const p of SAMPLE_PROPERTIES) {
    for (let meses = 1; meses <= 6; meses++) {
      const c = estadiaNoCartao(p, meses);
      if (!c) continue;
      cartoes++;
      assert.equal(somaDaComposicao(c.composicao), c.total, `${p.id}, ${meses} mês(es): ${c.composicao}`);
      assert.ok(NBSP(c.texto).includes(NBSP(formatBRL(c.total))), `${p.id}, ${meses}: cabeçalho "${c.texto}" × total ${c.total}`);
    }
  }
  assert.ok(cartoes >= 15 * 5, `cartões conferidos: ${cartoes}`);
});

test("o caso relatado (R$ 3.300/mês, 2 meses, preparação R$ 300, saída R$ 240) dá R$ 7.140 no cabeçalho e na conta", () => {
  const base = SAMPLE_PROPERTIES.find((p) => p.id === "ube-003")!; // contas medidas à parte, sem condomínio
  const sj = { ...base, id: "sao-jose", monthlyPrice: 3300, condoFee: 0, prepFee: 300, checkoutCleaningEnabled: true, checkoutCleaningFee: 240, limpezaEstadia: undefined };
  const c = estadiaNoCartao(sj, 2)!;
  assert.equal(c.total, 7140);
  assert.equal(NBSP(c.composicao), "2 × R$ 3.300 + limpeza de preparação R$ 300 + limpeza de saída R$ 240");
  assert.match(NBSP(c.texto), /R\$ 7\.140 em 2 meses/);
  assert.doesNotMatch(NBSP(c.texto), /4\.140/);
});

test("o cartão desenha o cabeçalho e a composição do MESMO objeto (estadiaNoCartao)", () => {
  const cartao = readFileSync(new URL("../components/property-card.tsx", import.meta.url), "utf8");
  assert.match(cartao, /const estadiaCartao = estadiaNoCartao\(property, preco\.meses\);/);
  assert.match(cartao, /\{estadiaCartao\?\.texto \?\? resumoEmMeses\(preco\.total, preco\.meses\)\}/);
  assert.match(cartao, /Total da estadia: \{estadiaCartao\.composicao\}/);
  // O plano B do cabeçalho (sem estadia calculável) nunca vem com composição: os dois saem juntos ou nenhum sai.
  assert.match(cartao, /\{estadiaCartao\?\.composicao && \(/);
});
