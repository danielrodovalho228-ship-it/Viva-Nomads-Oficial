import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { provarA0366, type ProvaDa0366 } from "../fixtures/prova-0366";
import { NO_LABORATORIO } from "../fixtures/laboratorio";

/*
  T1797 — 0366 @E1223 (ORDENS-DUET 1081 e 1090; regra da casa da ORDEM-DUET-1078: a trava que afirma comportamento é
  EXECUTADA num banco descartável). A própria 0366 e o rollback de produção, TAL COMO ESTÃO (sem reescrita de texto),
  corridos num banco descartável criado no servidor do laboratório e apagado no fim (tests/e2e/fixtures/prova-0366.ts),
  com o contador UDI em 4. Os seis casos:
   1. aplica e troca — UBE-002 → UDI-005, o contador vai a 5, e SÓ o número muda (o status e a cidade ficam);
   2. reaplica sem efeito;
   3. com 1 pedido de vistoria, não toca;
   4. com o número de destino já usado, não toca (e a 0366 não rebenta);
   5. o rollback desfaz (volta UBE-002; a outra linha fica);
   6. com o status já não em_teste, não toca.
  Morde, entre outros, o Me da Pista 3 (a 0366 a mudar também o status → o caso 1 vê o status mudado) e o Mq (o mesmo,
  com os nomes entre aspas — sem reescrita de texto, não há forma que escape). A trava que lê
  o texto (tests/migracoes/avaliador-ube002-para-udi-0366.test.ts) fica como complemento.
  Laboratório; não é prova ao vivo no site.
*/
const DB = process.env.LAB_DB_URL ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
const MIGRACAO_0366 = readFileSync("supabase/migrations/0366_avaliador_ube002_para_udi_e1223.sql", "utf8");
const ROLLBACK_0366 = readFileSync("supabase/producao/rollback/0366_rollback.sql", "utf8");

test.describe("T1797 — 0366 executada: os seis casos do coordenador @E1223", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ timeout: 120_000 });

  test("a 0366 e o rollback de produção corridos de verdade: troca só o número, sem efeito ao reaplicar, não toca com pedido / destino usado / status ≠ em_teste, o rollback desfaz", async () => {
    expect(MIGRACAO_0366, "a 0366 procura o UBE-002").toMatch(/'UBE-002'/);
    expect(ROLLBACK_0366, "o rollback devolve o UBE-002").toMatch(/set numero_credenciado = 'UBE-002'/);
    const p: ProvaDa0366 = await provarA0366(DB, MIGRACAO_0366, ROLLBACK_0366);
    // Asserções brandas: o relatório nomeia TODOS os casos que uma 0366 (ou um rollback) adulterada fere.
    // 1. aplica e troca — só o número.
    expect.soft(p.caso1.erro, "caso 1: a 0366 corre sem erro").toBeNull();
    expect.soft(p.caso1.depois.numero_credenciado, "caso 1: UBE-002 passa a UDI-005").toBe("UDI-005");
    expect.soft(p.caso1.depois.status, "caso 1: o status não muda (continua em_teste)").toBe(p.caso1.antes.status);
    expect.soft(p.caso1.depois.cidade, "caso 1: a cidade não muda").toBe(p.caso1.antes.cidade);
    expect.soft(p.caso1.contador, "caso 1: o contador UDI avança para 5").toBe(5);
    // 2. reaplica sem efeito.
    expect.soft(p.caso2.erro, "caso 2: reaplicada, corre sem erro").toBeNull();
    expect.soft(p.caso2.depois.numero_credenciado, "caso 2: continua UDI-005").toBe("UDI-005");
    expect.soft(p.caso2.contador, "caso 2: o contador não avança outra vez").toBe(5);
    // 3. com 1 pedido, não toca.
    expect.soft(p.caso3.erro, "caso 3: corre sem erro").toBeNull();
    expect.soft(p.caso3.depois.numero_credenciado, "caso 3: com 1 pedido, continua UBE-002").toBe("UBE-002");
    expect.soft(p.caso3.contador, "caso 3: o contador não avança").toBe(4);
    // 4. com o número de destino já usado, não toca.
    expect.soft(p.caso4.erro, "caso 4: corre sem erro (nunca tenta usar um número ocupado)").toBeNull();
    expect.soft(p.caso4.depois.numero_credenciado, "caso 4: com UDI-005 ocupado, continua UBE-002").toBe("UBE-002");
    expect.soft(p.caso4.outro.numero_credenciado, "caso 4: o dono do UDI-005 fica").toBe("UDI-005");
    expect.soft(p.caso4.contador, "caso 4: o contador não avança").toBe(4);
    // 5. o rollback desfaz.
    expect.soft(p.caso5.erroMigracao, "caso 5: a 0366 corre").toBeNull();
    expect.soft(p.caso5.depoisDaMigracao.numero_credenciado, "caso 5: a 0366 trocou").toBe("UDI-005");
    expect.soft(p.caso5.erroRollback, "caso 5: o rollback corre sem erro").toBeNull();
    expect.soft(p.caso5.depoisDoRollback.numero_credenciado, "caso 5: o rollback devolve UBE-002").toBe("UBE-002");
    expect.soft(p.caso5.depoisDoRollback.status, "caso 5: o status fica em_teste").toBe("em_teste");
    expect.soft(p.caso5.outro.numero_credenciado, "caso 5: a outra linha fica").toBe("UDI-003");
    // 6. com o status já não em_teste, não toca.
    expect.soft(p.caso6.erro, "caso 6: corre sem erro").toBeNull();
    expect.soft(p.caso6.depois.numero_credenciado, "caso 6: com status ativo, continua UBE-002").toBe("UBE-002");
    expect.soft(p.caso6.depois.status, "caso 6: o status fica ativo").toBe("ativo");
    expect.soft(p.caso6.contador, "caso 6: o contador não avança").toBe(4);
  });
});
