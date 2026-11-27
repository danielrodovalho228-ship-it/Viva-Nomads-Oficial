import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { provarA0369, PRAZOS_DA_PROVA, type ProvaDa0369 } from "../fixtures/prova-0369";
import { NO_LABORATORIO } from "../fixtures/laboratorio";

/*
  T1805 (número provisório) — 0369 @E1238 (ORDENS-DUET 1231 e 1233; regra da casa: a trava que afirma comportamento é
  EXECUTADA num banco descartável). A própria 0369, o aplicar e o rollback de produção, TAL COMO ESTÃO, corridos num
  banco descartável (tests/e2e/fixtures/prova-0369.ts), sobre `conferencias` na forma de ANTES: aplica sem mexer nas
  linhas, reaplica sem efeito, a conferência nova nasce com o prazo e a segunda abertura NÃO o muda (o congelamento);
  o rollback tira a coluna e o registo. A trava que lê o texto (tests/migracoes/conferencias-prazo-0369.test.ts) fica
  como complemento. Laboratório; não é prova ao vivo no site.
*/
const DB = process.env.LAB_DB_URL ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
const MIGRACAO = readFileSync("supabase/migrations/0369_conferencias_prazo_e1238.sql", "utf8");
const APLICAR = readFileSync("supabase/producao/aplicar-0369.sql", "utf8");
const ROLLBACK = readFileSync("supabase/producao/rollback/0369_rollback.sql", "utf8");

test.describe("T1805 — 0369 executada: o prazo da conferência gravado e congelado @E1238", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ timeout: 120_000 });

  test("a 0369, o aplicar e o rollback corridos de verdade", async () => {
    const p: ProvaDa0369 = await provarA0369(DB, MIGRACAO, APLICAR, ROLLBACK);
    expect.soft(p.migracao.erro, "a 0369 aplica-se sem erro").toBeNull();
    expect.soft(p.migracao.linhas, "as duas conferências de antes").toBe(2);
    expect.soft(p.migracao.iguais, "as conferências que já existiam ficam iguais (a fechada não reabre)").toBe(true);
    expect.soft(p.migracao.prazosVazios, "as de antes ficam sem prazo gravado").toBe(true);
    expect.soft(p.reaplicar.erro, "reaplicada, sem erro").toBeNull();
    expect.soft(p.aplicar.erro1).toBeNull();
    expect.soft(p.aplicar.erro2, "o aplicar reaplica sem erro").toBeNull();
    expect.soft(p.aplicar.registos, "regista-se uma vez").toBe(1);
    expect.soft(p.aplicar.nome).toBe("0369_conferencias_prazo_e1238");
    expect.soft(p.nova.erro).toBeNull();
    expect.soft(p.nova.prazo, "a conferência nova nasce com o prazo").toBe(PRAZOS_DA_PROVA.PRAZO_1);
    expect.soft(p.congelado.erro).toBeNull();
    expect.soft(p.congelado.prazo, "a segunda abertura não muda o prazo (congelado)").toBe(PRAZOS_DA_PROVA.PRAZO_1);
    expect.soft(p.rollback.erroRollback, "o rollback corre").toBeNull();
    expect.soft(p.rollback.coluna, "o rollback tira a coluna").toBe(false);
    expect.soft(p.rollback.registo, "sai o registo da 0369").toBe(0);
    expect.soft(p.rollback.linhas, "as conferências ficam").toBe(0);
  });
});
