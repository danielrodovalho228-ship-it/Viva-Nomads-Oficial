/*
  Ordem c54366b0 (Daniel, 14/10) — complemento da b3c9d76e: comissão sobre o VALOR TOTAL do
  contrato (aluguel × meses), o mesmo número no painel, no contrato registrado, na cobrança,
  nos simuladores, na projeção e no admin. Nenhuma tela ativa fala em "primeiro mês".
  Roda: node --test src/lib/comissao.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { valorComissao, valorTotalContrato } from "./comissao.ts";
import { resumoContrato } from "./contrato-blocos.ts";
import { cobrancaParaAceite } from "./cobranca/regra.ts";
import { simularRentabilidade } from "./simulador.ts";
import { calcularFinanceiro } from "./admin/financeiro.ts";

const SRC = new URL("../", import.meta.url).pathname;

test("os 3 exemplos da ordem: R$ 3.000 × 1 / 3 / 6 meses → total 3.000 / 9.000 / 18.000 → comissão 360 / 1.080 / 2.160 — em todo lugar", () => {
  assert.deepEqual([1, 3, 6].map((m) => valorTotalContrato(3000, m)), [3000, 9000, 18000]);
  assert.deepEqual([1, 3, 6].map((m) => valorComissao(3000, m, 0.12)), [360, 1080, 2160]);
  const em = new Date("2026-10-14T12:00:00Z");
  assert.deepEqual([1, 3, 6].map((meses) => cobrancaParaAceite({ tipo: "novo", imoveisAtivos: 1, aluguelMensal: 3000, meses, assinadoEm: em }).valor), [360, 1080, 2160]);
  assert.deepEqual([1, 3, 6].map((m) => resumoContrato(m, 3000, 0.12, 3).comissaoValor), [360, 1080, 2160]);
  // Simulador do dono: 1 contrato/ano de m meses → a comissão do ano é a do contrato.
  assert.deepEqual([1, 3, 6].map((m) => simularRentabilidade({ aluguelMensal: 3000, condoIptu: 0, contas: 0, mesesOcupados: m, prazoMedioMeses: m }, 0.12, 0).comissaoAnual), [360, 1080, 2160]);
  assert.equal(valorTotalContrato(3000, 0), 0);
  assert.equal(valorTotalContrato(-1, 3), 0);
});

test("admin: take rate = comissão ÷ valor total dos contratos (não ÷ aluguel mensal)", () => {
  const f = calcularFinanceiro({
    comissoes: [
      { contrato: "a", data: "2026-10-01", imovel: null, cidade: null, plano: null, percentual: 0.12, aluguel: 3000, comissao: 1080, status: "pago", pago_em: null },
      { contrato: "b", data: "2026-10-02", imovel: null, cidade: null, plano: null, percentual: 0.1, aluguel: 2000, comissao: 600, status: "pendente", pago_em: null },
    ],
  } as never);
  assert.equal(f.valorTotalContratado, 9000 + 6000);
  assert.equal(f.takeRate, 1680 / 15000);
});

test("contrato modelo (congelado) não tem cláusula de comissão — nada a alterar nele", () => {
  assert.doesNotMatch(readFileSync(join(SRC, "lib/modelos-contrato.ts"), "utf8"), /comiss|taxa de servi/i);
});
