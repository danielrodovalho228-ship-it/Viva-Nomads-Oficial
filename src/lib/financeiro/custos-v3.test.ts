/*
  Modelo de custos v3 (validado pelo coordenador; ordem do Daniel, 05/11/2026 — continuação do E559/E592): /simulacao e
  /roi com as premissas vigentes. Nada da projeção antiga (até R$ 69,3 mil, 1º mês positivo no 14, payback no 27; exemplo
  de R$ 4.320 × 12% fixo).
  Roda: node --test src/lib/financeiro/custos-v3.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  ALUGUEL_MEDIO,
  CUSTOS_FIXOS,
  CUSTOS_POR_CONTRATO,
  CUSTOS_UNICOS,
  DOLAR,
  FORA_DO_FIXO,
  MESES_MEDIOS_CONTRATO,
  REGIMES,
  REGIME_PADRAO,
  SELO_SOCIETARIO,
  TAXA_FAIXAS,
  marketingDoMes,
} from "../../config/premissas-financeiras.ts";
import { RATEIO_UNICOS_MES, cenariosContratosMes, custoFixoDe, fraseResumo, porContrato, projetar } from "./projecao.ts";

const ler = (p: string) => readFileSync(new URL(`../../../${p}`, import.meta.url), "utf8");

test("v3: contrato de referência R$ 3.000 × 3 meses, na faixa da carteira 12/10/8/6 (nunca 12% fixo)", () => {
  assert.equal(ALUGUEL_MEDIO, 3000);
  assert.equal(MESES_MEDIOS_CONTRATO, 3);
  assert.deepEqual(TAXA_FAIXAS.map((f) => f.taxa), [0.12, 0.1, 0.08, 0.06]);
  assert.deepEqual(TAXA_FAIXAS.map((f) => porContrato({ operador: 0, taxa: f.taxa }).receita), [1080, 900, 720, 540]);
});

test("v3: regime Simples (~6%) × Lucro Presumido (~13,3%, até ~16,3% com ISS 5%); Presumido em destaque; societário em revisão", () => {
  assert.deepEqual(REGIMES.map((r) => [r.id, r.aliquota, r.inssPatronal]), [
    ["simples", 0.06, 0],
    ["presumido", 0.1333, 0.2],
    ["presumido_iss5", 0.1633, 0.2],
  ]);
  assert.equal(REGIME_PADRAO, "presumido");
  assert.match(SELO_SOCIETARIO, /em revisão/);
});

test("v3: equilíbrio ≈ 10 (Simples) e ≈ 13 (Presumido); com 20 contratos ≈ R$ 8,1 mil × R$ 5,0–5,6 mil", () => {
  const empate = (regime: (typeof REGIMES)[number]["id"]) => Math.ceil(custoFixoDe({ regime }) / porContrato({ operador: 0, regime }).margem);
  assert.equal(empate("simples"), 10);
  assert.ok([13, 14].includes(empate("presumido")) && [13, 14].includes(empate("presumido_iss5")));
  const vinte = (regime: (typeof REGIMES)[number]["id"]) => cenariosContratosMes({ operador: 0, regime })[1].resultado;
  assert.ok(Math.abs(vinte("simples") - 8200) < 300, String(vinte("simples")));
  for (const r of ["presumido", "presumido_iss5"] as const) assert.ok(vinte(r) >= 4700 && vinte(r) <= 5700, `${r}: ${vinte(r)}`);
});

test("v3: as linhas do modelo estão presentes — CDL, e-mail, marketing pago em 0, parecer e consulta únicos rateados", () => {
  const linha = (r: RegExp) => CUSTOS_FIXOS.find((c) => r.test(c.rotulo));
  assert.equal(linha(/CDL/)?.valor, 100);
  assert.ok(linha(/e-mail/));
  assert.equal(linha(/Marketing pago/)?.valor, 0);
  assert.equal(marketingDoMes(1), 0);
  assert.equal(marketingDoMes(36), 0);
  assert.equal(linha(/Pró-labore/)?.valor, 6000);
  assert.deepEqual(CUSTOS_UNICOS.map((c) => [c.rotulo, c.valor]), [["Parecer jurídico", 4000], ["Consulta jurídica", 500]]);
  assert.equal(RATEIO_UNICOS_MES, 4500 / 36);
  // o rateio entra na projeção (custo fixo do mês) mas não nos cenários de um mês
  const p = projetar("base", { operador: 0 });
  assert.ok(Math.abs(p.meses[0].custoFixo - (custoFixoDe({}) + RATEIO_UNICOS_MES)) < 1e-9);
  assert.equal(DOLAR, 5.2);
});

test("v3: fora do fixo sem número inventado — Stays só na fase 2 do Gestor; seguro: a Viva não tem hoje", () => {
  assert.ok(FORA_DO_FIXO.some((f) => /Stays/.test(f) && /fase 2 do Gestor/.test(f)));
  assert.ok(FORA_DO_FIXO.some((f) => /[Ss]eguro/.test(f) && /a Viva não tem hoje/.test(f) && /decisão pendente/.test(f)));
  for (const f of FORA_DO_FIXO) assert.ok(!/R\$ ?\d/.test(f), f);
});

test("v3: Certta sem preço público — 1,7 × R$ 20 = R$ 34 por contrato é HIPÓTESE, nunca preço", () => {
  const id = CUSTOS_POR_CONTRATO.find((c) => /Certta/.test(c.rotulo))!;
  assert.equal(id.valor, 34);
  assert.match(id.obs ?? "", /hipótese/);
  assert.match(id.obs ?? "", /não tem preço público/);
});

test("v3: a frase do topo não repete a projeção antiga; /simulacao e /roi usam o mesmo componente", () => {
  const p = projetar("base", { operador: 0 });
  const f = fraseResumo("Base", p, p, 0);
  assert.doesNotMatch(f, /69,3 mil|mês 14|mês 27/);
  const comp = ler("src/components/financeiro/modelo-financeiro.tsx");
  assert.match(comp, /data-testid="seletor-regime"/);
  assert.match(comp, /data-testid="seletor-faixa"/);
  assert.doesNotMatch(comp, /4\.320|4320|anexo V/); // "nunca 12% fixo" pode aparecer como regra, não como premissa
  for (const pg of ["src/app/simulacao/page.tsx", "src/app/roi/page.tsx"]) assert.match(ler(pg), /<ModeloFinanceiro pagina=/);
});
