import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { provarA0368, type ProvaDa0368 } from "../fixtures/prova-0368";
import { NO_LABORATORIO } from "../fixtures/laboratorio";

/*
  T1799 — 0368 @E1229 (ORDENS-DUET 1160 e 1162; regra da casa: a trava que afirma comportamento é EXECUTADA num banco
  descartável). A própria 0368, o aplicar e o rollback de produção, TAL COMO ESTÃO, corridos num banco descartável
  criado no servidor do laboratório e apagado no fim (tests/e2e/fixtures/prova-0368.ts), sobre contrato_eventos na forma
  de ANTES da 0368: aplica, reaplica sem efeito, o tipo novo entra e um tipo fora da lista continua recusado; o rollback
  falha com um "pagamento_anulado" gravado (nada muda) e, sem ele, repõe a lista antiga.
  ORDEM-DUET-1169: e a função anular_pagamento, numa transação só (ou tudo, ou nada) — com uma falha SIMULADA na
  gravação do evento, o pagamento e o documento ficam intactos.
  A trava que lê o texto (tests/migracoes/contrato-eventos-pagamento-anulado-0368.test.ts) fica como complemento.
  Laboratório; não é prova ao vivo no site.
*/
const DB = process.env.LAB_DB_URL ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
const MIGRACAO = readFileSync("supabase/migrations/0368_contrato_eventos_pagamento_anulado_e1229.sql", "utf8");
const APLICAR = readFileSync("supabase/producao/aplicar-0368.sql", "utf8");
const ROLLBACK = readFileSync("supabase/producao/rollback/0368_rollback.sql", "utf8");

test.describe("T1799 — 0368 executada: o tipo pagamento_anulado na trilha do contrato @E1229", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ timeout: 120_000 });

  test("a 0368, o aplicar e o rollback corridos de verdade", async () => {
    const p: ProvaDa0368 = await provarA0368(DB, MIGRACAO, APLICAR, ROLLBACK);
    expect.soft(p.migracao.erro, "a 0368 aplica-se sem erro").toBeNull();
    expect.soft(p.migracao.eventos, "os 12 eventos de antes").toBe(12);
    expect.soft(p.migracao.iguais, "os eventos que já existiam ficam iguais").toBe(true);
    expect.soft(p.depois.pagamentoAnulado, "depois da 0368, um pagamento_anulado entra").toBeNull();
    expect.soft(p.depois.foraDaLista, "um tipo fora da lista continua recusado").toMatch(/contrato_eventos_tipo_check/);
    expect.soft(p.reaplicar.erro, "reaplicada, sem erro").toBeNull();
    expect.soft(p.reaplicar.checkIgual, "reaplicada, o mesmo check").toBe(true);
    expect.soft(p.aplicar.erro1).toBeNull();
    expect.soft(p.aplicar.erro2, "o aplicar reaplica sem erro").toBeNull();
    expect.soft(p.aplicar.registos, "regista-se uma vez").toBe(1);
    expect.soft(p.aplicar.nome).toBe("0368_contrato_eventos_pagamento_anulado_e1229");
    expect.soft(p.rollbackComEvento.erroMigracao).toBeNull();
    expect.soft(p.rollbackComEvento.erroRollback, "com um pagamento_anulado gravado, o rollback FALHA").not.toBeNull();
    expect.soft(p.rollbackComEvento.eventosIguais, "e nada muda nos eventos").toBe(true);
    expect.soft(p.rollbackComEvento.aceitaAinda, "o check novo continua").toBe(true);
    expect.soft(p.rollbackLimpo.erroMigracao).toBeNull();
    expect.soft(p.rollbackLimpo.erroRollback, "sem eventos novos, o rollback corre").toBeNull();
    expect.soft(p.rollbackLimpo.eventosIguais, "os eventos ficam").toBe(true);
    expect.soft(p.rollbackLimpo.pagamentoAnulado, "o check antigo volta: pagamento_anulado recusado outra vez").toMatch(/contrato_eventos_tipo_check/);
    expect.soft(p.rollbackLimpo.registo, "sai o registo da 0368").toBe(0);
    expect.soft(p.rollbackLimpo.funcaoFica, "o rollback tira a função").toBe(false);
    // A função anular_pagamento (ORDEM-DUET-1169).
    const f = p.funcao;
    expect.soft(f.erroAplicar).toBeNull();
    expect.soft(f.dono.resposta, "o dono, antes da confirmação: anula").toMatchObject({ ok: true });
    expect.soft(f.dono.pagamento, "o pagamento anulado, com o motivo").toEqual({ anulado: true, motivo: "valor lançado errado" });
    expect.soft(f.dono.documento, "o documento anulado junto").toEqual({ anulado: true, motivo: "valor lançado errado" });
    expect.soft(f.dono.eventos.length, "um evento").toBe(1);
    expect.soft(f.dono.eventos[0]?.dados).toMatchObject({ caminho: "dono", motivo: "valor lançado errado", valor: 3200 });
    expect.soft(f.dono.eventos[0]?.dados.documento, "o evento nomeia o documento").toMatch(/^REC-2026-/);
    expect.soft(f.donoConfirmado.resposta, "o dono, depois da confirmação: não anula").toMatchObject({ ok: false });
    expect.soft(f.donoConfirmado.pagamento.anulado).toBe(false);
    expect.soft(f.donoConfirmado.documento.anulado).toBe(false);
    expect.soft(f.donoConfirmado.eventos).toBe(0);
    expect.soft(f.central.resposta, "a Central anula o confirmado").toMatchObject({ ok: true });
    expect.soft(f.central.pagamento.anulado).toBe(true);
    expect.soft(f.central.eventos[0]?.dados).toMatchObject({ caminho: "central", chamado: "CH-2026-000777" });
    expect.soft(f.outraVez.resposta, "outra vez: não anula de novo").toMatchObject({ ok: false });
    expect.soft(f.outraVez.eventos, "um evento só").toBe(1);
    expect.soft(f.falhaNoEvento.erro, "a falha simulada na gravação do evento").toMatch(/falha simulada/);
    expect.soft(f.falhaNoEvento.pagamento, "o pagamento fica intacto").toEqual({ anulado: false, motivo: null });
    expect.soft(f.falhaNoEvento.documento, "o documento fica intacto").toEqual({ anulado: false, motivo: null });
    expect.soft(f.falhaNoEvento.eventos).toBe(0);
    expect.soft(f.semPermissao, "quem não é o servidor não executa a função").toMatch(/permission denied/);
  });
});
