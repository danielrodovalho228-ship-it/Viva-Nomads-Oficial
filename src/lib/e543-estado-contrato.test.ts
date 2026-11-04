/*
  E543 — contrato com três estados ao mesmo tempo (VN-CT-A0268B00): lista e detalhe "Aguardando 1º pagamento", o bloco
  "Encerrado" e a página da estadia "Encerrada em 30/10/2026". A função única do estado (estadoDoContratoUnico) só lia
  status, assinaturas e pagamentos — ignorava o período, que a página da estadia (topoDaEstadia) já lia. Agora a fonte
  única também lê o período: contrato "ativo" com o período já terminado (calendário de Brasília) é "Encerrado em
  DD/MM/AAAA" em toda tela, e não ocupa mais o imóvel.
  Roda: node --test src/lib/e543-estado-contrato.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { COLUNAS_ESTADO_CONTRATO, estadoDoContratoUnico, tomDoSelo } from "./contrato-estado.ts";
import { topoDaEstadia } from "./estadia/estadia.ts";
import { lerDaterange } from "./contrato-periodo.ts";

const t = "2026-09-27T00:00:00Z";
const agora = new Date("2026-11-04T20:00:00Z");
// O caso do QA: assinado pelas duas partes, sem pagamento, período [2026-09-30, 2026-10-31) — fim inclusivo 30/10.
const a0268 = { status: "ativo", assinado_proprietario_em: t, assinado_inquilino_em: t, pagamentos_bloco: [], periodo: "[2026-09-30,2026-10-31)" };

test("período terminado: a fonte única diz 'Encerrado em 30/10/2026' (não 'Aguardando 1º pagamento') e não ocupa o imóvel", () => {
  for (const papel of ["proprietario", "inquilino"] as const) {
    const e = estadoDoContratoUnico(a0268, papel, agora);
    assert.equal(e.chave, "encerrado_periodo");
    assert.equal(e.selo, "Encerrado em 30/10/2026");
    assert.equal(e.ativo, false);
    assert.equal(e.etapa, null);
    assert.equal(tomDoSelo(e), "bg-surface-2 text-muted");
  }
});

test("a mesma data que a página da estadia mostra", () => {
  const p = lerDaterange(a0268.periodo)!;
  assert.equal(topoDaEstadia(p, { status: "ativo" }, agora).texto, "Encerrada em 30/10/2026");
});

test("período em curso ou futuro: nada muda (último dia ainda é vigente)", () => {
  assert.equal(estadoDoContratoUnico({ ...a0268, periodo: "[2026-11-10,2026-12-11)" }, "inquilino", agora).selo, "Aguardando 1º pagamento");
  assert.equal(estadoDoContratoUnico({ ...a0268, periodo: "[2026-10-05,2026-11-05)" }, "inquilino", agora).selo, "Aguardando 1º pagamento");
  // Sem período (linha antiga): a regra de sempre.
  const { periodo: _p, ...semPeriodo } = a0268;
  assert.equal(estadoDoContratoUnico(semPeriodo, "inquilino", agora).selo, "Aguardando 1º pagamento");
  // Status de encerramento continua mandando.
  assert.equal(estadoDoContratoUnico({ ...a0268, status: "cancelado" }, "inquilino", agora).selo, "Cancelado");
});

test("quem lê pelo COLUNAS_ESTADO_CONTRATO já traz o período", () => {
  assert.match(COLUNAS_ESTADO_CONTRATO, /\bperiodo\b/);
});

test("as leituras das telas do contrato (lista, detalhe, assinatura) trazem o período para a fonte única", async () => {
  const { readFileSync } = await import("node:fs");
  const ca = readFileSync("src/lib/data/contratos-actions.ts", "utf8");
  assert.match(ca, /"id, property_id, tenant_id, lead_id, status, periodo, aluguel_mensal/);
  assert.match(ca, /\.select\("id, status, periodo, created_at, assinado_proprietario_em/);
  assert.match(ca, /\.select\("id, status, periodo, aluguel_mensal, created_at/);
  assert.match(ca, /\.select\(`id, property_id, aluguel_mensal, status, periodo, created_at, encerrado_em/);
  assert.match(readFileSync("src/lib/data/contrato-assinar-actions.ts", "utf8"), /"id, tenant_id, status, periodo, aluguel_mensal/);
});
