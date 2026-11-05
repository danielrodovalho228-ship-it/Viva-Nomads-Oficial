/*
  E562 (REPROVA de 05/11) — o que ainda saía em meses depois do #2534:
   - o e-mail da candidatura: "Total da estadia" = total mensal × meses arredondados (43 dias → 2 meses);
   - o Fechamento com proposta aceita: prazo "2 meses", base e taxa por meses;
   - a cobrança da taxa (/api/comissao): meses = round(dias ÷ 30) → 43 dias cobravam a taxa de 1 mês.
  Roda: node --test src/lib/e562-reprova-dias.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resumoContratoEmDias } from "./contrato-blocos.ts";
import { cobrancaSimuladaTeste } from "./contas-de-teste.ts";

const ler = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

test("cobrança da taxa: o valor gravado no contrato (em dias), não meses arredondados", () => {
  const r = resumoContratoEmDias(43, 2800, 0.12);
  // 2.800 × 43 ÷ 30 = 4.013,33 → 12% = 481,60
  assert.equal(r.valorTotalPeriodo, 4013.33);
  const cobrada = cobrancaSimuladaTeste({ aluguelMensal: 2800, meses: Math.round(43 / 30), commissionRate: 0.12, valor: r.comissaoValor });
  assert.equal(cobrada.platformCommission, r.comissaoValor);
  assert.notEqual(cobrada.platformCommission, Math.round(2800 * 1 * 0.12 * 100) / 100, "não a taxa de 1 mês");
  // Sem o valor do contrato (contrato antigo), a conta de antes.
  assert.equal(cobrancaSimuladaTeste({ aluguelMensal: 3200, meses: 4, commissionRate: 0.12 }).platformCommission, 1536);
  const rota = ler("app/api/comissao/route.ts");
  assert.match(rota, /valor: contrato\.comissaoValor/);
  assert.match(ler("lib/data/fechamento-servidor.ts"), /select\("aluguel_mensal, prazo_total_dias, comissao_percent, comissao_valor"\)/);
  assert.match(ler("lib/payments/asaas.ts"), /const platformCommission = params\.valor != null && params\.valor >= 0 \? params\.valor : valorComissao\(/);
});

test("Fechamento com proposta aceita: prazo, blocos, base e taxa pelos DIAS da proposta", () => {
  const f = ler("app/(dashboard)/dashboard/fechamento/closing-flow.tsx");
  assert.match(f, /const DIAS_ACORDO = ACORDO\?\.termos\?\.dias && ACORDO\.termos\.dias > 0 \? ACORDO\.termos\.dias : null;/);
  assert.match(f, /const STAY_DAYS = DIAS_ACORDO \?\? prazoMeses \* 30;/);
  assert.match(f, /DIAS_ACORDO \? resumoContratoEmDias\(DIAS_ACORDO, PROPERTY\.monthlyRent, COMMISSION_RATE, TAMANHO_BLOCO\)/);
  assert.match(f, /data-testid="fechamento-prazo-dias">\{PRAZO_TEXTO\}/);
  assert.match(f, /<Row label="Prazo" value=\{PRAZO_TEXTO\} \/>/);
  assert.match(f, /× \$\{DIAS_ACORDO\} dias ÷ 30\)/);
});

test("e-mail da candidatura: o total da estadia em dias, pela conta do anúncio", () => {
  // Na main, o E583 (#2650) passou a estadia inteira (rótulo, total e conta) pela mesma função da tela.
  const c = ler("lib/data/candidatura-email.ts");
  assert.match(c, /estadiaDias: publico && p \? estadiaDoImovelEmDias\(publico, p\.dias\) : null,/);
});
