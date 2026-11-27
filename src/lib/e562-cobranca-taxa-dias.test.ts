/*
  E562 (resíduo de código, 05/11): a cobrança da taxa de serviço (/api/comissao) lia o contrato e usava
  meses = round(prazo_total_dias ÷ 30). Num contrato de 43 dias, a taxa saía sobre 1 mês (o dono pagava menos do que o
  registro do contrato, que já é em dias). Agora a cobrança usa os DIAS do contrato, pela mesma regra do registro
  (comissaoSobreDias) — no Asaas e na cobrança simulada das contas de teste.
  Roda: node --test src/lib/e562-cobranca-taxa-dias.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { comissaoSobreDias, comissaoSobreContrato } from "./cobranca/regra.ts";
import { cobrancaSimuladaTeste } from "./contas-de-teste.ts";

const ler = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

test("43 dias a R$ 2.800 e 12%: a taxa é a dos 43 dias (R$ 481,60), não a de 1 mês (R$ 336)", () => {
  assert.equal(comissaoSobreDias(2800, 43, 0.12), 481.6);
  assert.equal(comissaoSobreContrato(2800, Math.round(43 / 30), 0.12), 336);
  const sim = cobrancaSimuladaTeste({ aluguelMensal: 2800, meses: 1, dias: 43, commissionRate: 0.12 });
  assert.equal(sim.platformCommission, 481.6);
  // Sem dias (contrato antigo), a conta de antes.
  assert.equal(cobrancaSimuladaTeste({ aluguelMensal: 3000, meses: 3, commissionRate: 0.12 }).platformCommission, 1080);
});

test("a rota e o Asaas passam e usam os dias do contrato", () => {
  const srv = ler("lib/data/fechamento-servidor.ts");
  assert.match(srv, /dias: Number\(data\.prazo_total_dias\)/);
  const rota = ler("app/api/comissao/route.ts");
  assert.equal((rota.match(/dias: contrato\.dias/g) ?? []).length, 2, "Asaas e cobrança simulada");
  assert.match(ler("lib/payments/asaas.ts"), /params\.dias \? comissaoSobreDias\(params\.aluguelMensal, params\.dias, params\.commissionRate\)/);
});

test("Fechamento com proposta aceita: prazo, blocos, base e taxa nos DIAS da proposta (sem proposta, os meses de antes)", () => {
  const f = ler("app/(dashboard)/dashboard/fechamento/closing-flow.tsx");
  assert.match(f, /const DIAS_ACORDO = ACORDO\?\.termos\?\.dias && ACORDO\.termos\.dias > 0 \? ACORDO\.termos\.dias : DIAS_CANDIDATURA;/);
  assert.match(f, /DIAS_ACORDO \? resumoContratoEmDias\(DIAS_ACORDO, PROPERTY\.monthlyRent, COMMISSION_RATE, TAMANHO_BLOCO\)/);
  assert.match(f, /data-testid="fechamento-prazo-dias"/);
  assert.match(f, /<Row label="Prazo" value=\{PRAZO_TEXTO\} \/>/);
  assert.match(f, /× \$\{DIAS_ACORDO\} dias ÷ 30\)/);
});
