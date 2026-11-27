/* Roda: node --test src/lib/e584-rotulos-passo1.test.ts — E584: o passo 1 da proposta nomeia cada parcela, como o painel. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resumoSolicitacao, parcelasDoResumo } from "./reserva-imovel.ts";
import { calcularTotalMensal } from "./precos.ts";
import type { Property } from "./types.ts";
import { formatBRL } from "./utils.ts";

/** O caso do reteste do morador (05/11): mensal R$ 2.800, contas fixas R$ 250, preparação R$ 300. */
const IMOVEL = {
  monthlyPrice: 2800,
  condoFee: 0,
  utilitiesMode: "fixed",
  utilitiesEstimate: 250,
  prepFee: 300,
  checkoutCleaningEnabled: false,
  checkoutCleaningFee: 0,
  limpezaEstadia: null,
} as unknown as Property;

const resumo = () => {
  const mes = calcularTotalMensal(IMOVEL);
  return resumoSolicitacao({ monthlyPrice: 2800, hoje: "2026-11-05", totalMensal: mes.total, ...parcelasDoResumo(mes) });
};

test("E584: contas e limpeza de preparação têm linha própria, com o rótulo do painel do anúncio", () => {
  const linhas = resumo().linhas;
  const v = (r: string) => linhas.find((l) => l.rotulo === r)?.valor;
  assert.equal(v("Mensal"), formatBRL(2800));
  assert.equal(v("Água, luz e gás (estimativa)"), formatBRL(250));
  assert.equal(v("Limpeza de preparação — cobrada uma única vez"), formatBRL(300));
  // Nenhum número muda: o total por mês segue 2.800 + 250.
  assert.equal(v("Total por mês (com contas)"), formatBRL(3050));
});

test("E584: as linhas novas ficam à vista no passo 1 (não escondidas em 'Detalhes dos valores'), na ordem do painel", () => {
  const linhas = resumo().linhas;
  const visiveis = linhas.filter((l) => l.revisar).map((l) => l.rotulo);
  assert.deepEqual(visiveis, ["Água, luz e gás (estimativa)", "Limpeza de preparação — cobrada uma única vez"]);
  const ordem = linhas.map((l) => l.rotulo);
  assert.ok(ordem.indexOf("Mensal") < ordem.indexOf("Água, luz e gás (estimativa)"));
  assert.ok(ordem.indexOf("Água, luz e gás (estimativa)") < ordem.indexOf("Total por mês (com contas)"));
  assert.ok(ordem.indexOf("Total por mês (com contas)") < ordem.indexOf("Limpeza de preparação — cobrada uma única vez"));
});

test("E584: sem contas nem preparação no anúncio, nenhuma linha nova aparece", () => {
  const mes = calcularTotalMensal({ ...IMOVEL, utilitiesEstimate: 0, prepFee: 0 } as Property);
  const r = resumoSolicitacao({ monthlyPrice: 2800, hoje: "2026-11-05", totalMensal: mes.total, ...parcelasDoResumo(mes) });
  assert.equal(r.linhas.some((l) => l.revisar), false);
});

test("E584: a página do anúncio passa as parcelas ao resumo e mostra as linhas marcadas no passo 1", () => {
  const pagina = readFileSync(new URL("../app/(public)/imoveis/[id]/property-detail.tsx", import.meta.url), "utf8");
  assert.match(pagina, /\.\.\.parcelasDoResumo\(calcularTotalMensal\(property\)\)/);
  assert.match(pagina, /l\.revisar \|\| LINHAS_REVISAR\.has\(l\.rotulo\)/);
  assert.match(pagina, /!l\.revisar && !LINHAS_REVISAR\.has\(l\.rotulo\)/);
});
