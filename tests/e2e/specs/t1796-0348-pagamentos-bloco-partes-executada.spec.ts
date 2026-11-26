import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { provarA0348, type ProvaDa0348 } from "../fixtures/prova-0348";
import { NO_LABORATORIO } from "../fixtures/laboratorio";

/*
  T1796 — 0348 @E1072 (ORDENS-DUET 1078, 1084 e 1087; regra da casa: a trava que afirma comportamento é EXECUTADA num
  banco descartável). A própria 0348 e o rollback de produção, TAL COMO ESTÃO (sem reescrita de texto), corridos num
  banco descartável criado no servidor do laboratório e apagado no fim (tests/e2e/fixtures/prova-0348.ts), sobre
  pagamentos_bloco na forma de ANTES da 0348. Os quatro casos do coordenador:
   1. um 2.º registro de aluguel ativo com a MESMA parte no mesmo bloco é recusado;
   2. um registro com a parte 2 no mesmo bloco é aceito;
   3. o anulado não ocupa a parte: anulada a parte 1, uma nova parte 1 é aceita;
   4. o rollback com um complementar ativo falha e nada muda (a coluna e os dois registros continuam lá).
  Morde o Q5 da Pista 3 (uma linha no fim da 0348 a apagar o índice novo → o caso 1 aceita a 2.ª parte 1) e o Q6 (o
  rollback a anular os complementares → o caso 4 vê o rollback passar e um registro anulado). ORDEM-DUET-1084: também o
  Q6q (a mesma anulação com os nomes entre aspas — sem reescrita de texto, não há forma que escape) e o Q4m (a 0348 a
  anular registros, com motivo). A trava que lê o texto
  (tests/migracoes/pagamentos-bloco-partes-0348.test.ts) fica como complemento.
  Laboratório; não é prova ao vivo no site.
*/
const DB = process.env.LAB_DB_URL ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
const MIGRACAO_0348 = readFileSync("supabase/migrations/0348_pagamentos_bloco_partes_e1072.sql", "utf8");
const ROLLBACK_0348 = readFileSync("supabase/producao/rollback/0348_rollback.sql", "utf8");

test.describe("T1796 — 0348 executada: os quatro casos do coordenador @E1072", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ timeout: 120_000 });

  test("a 0348 e o rollback de produção corridos de verdade: recusa a mesma parte, aceita a parte 2, o anulado não ocupa, o rollback com complementar falha sem mudar nada", async () => {
    expect(MIGRACAO_0348, "a 0348 tem o índice novo").toMatch(/pagamentos_bloco_uma_parte_por_bloco/);
    expect(ROLLBACK_0348, "o rollback repõe o índice antigo").toMatch(/pagamentos_bloco_um_valor_mensal/);
    const p: ProvaDa0348 = await provarA0348(DB, MIGRACAO_0348, ROLLBACK_0348);
    // Asserções brandas: o relatório nomeia TODOS os casos que uma 0348 (ou um rollback) adulterada fere.
    expect.soft(p.migracao.erro, "a 0348 aplica-se sem erro na forma de antes").toBeNull();
    expect.soft(p.migracao.registroDeAntes, "a 0348 não regrava nem anula o registro que já existia").toEqual({ parte: 1, ativo: true, valor: 2500 });
    // 1. mesma parte no mesmo bloco → recusada.
    expect.soft(p.caso1.erroDaMigracao, "caso 1: a 0348 corre").toBeNull();
    expect.soft(p.caso1.segunda, "caso 1: o 2.º aluguel ativo com a mesma parte é recusado").toMatch(/pagamentos_bloco_uma_parte_por_bloco|duplicate key/);
    expect.soft(p.caso1.ativosNaParte1, "caso 1: continua um só aluguel ativo na parte 1").toBe(1);
    // 2. parte 2 → aceita.
    expect.soft(p.caso2.erroDaMigracao, "caso 2: a 0348 corre").toBeNull();
    expect.soft(p.caso2.parte2, "caso 2: a parte 2 no mesmo bloco é aceita").toBeNull();
    expect.soft(p.caso2.ativos, "caso 2: dois registros ativos no bloco").toBe(2);
    // 3. o anulado não ocupa a parte.
    expect.soft(p.caso3.erroDaMigracao, "caso 3: a 0348 corre").toBeNull();
    expect.soft(p.caso3.anular, "caso 3: a parte 1 é anulada").toBeNull();
    expect.soft(p.caso3.novaParte1, "caso 3: anulada a parte 1, uma nova parte 1 é aceita").toBeNull();
    expect.soft(p.caso3.ativosNaParte1, "caso 3: um só aluguel ativo na parte 1").toBe(1);
    // 4. rollback com complementar ativo → falha, e nada muda.
    expect.soft(p.caso4.erroDaMigracao, "caso 4: a 0348 corre").toBeNull();
    expect.soft(p.caso4.complemento, "caso 4: o complementar (parte 2) entra").toBeNull();
    expect.soft(p.caso4.antes, "caso 4: antes do rollback, as partes 1 e 2 ativas").toEqual([{ parte: 1, ativo: true }, { parte: 2, ativo: true }]);
    expect.soft(p.caso4.erroDoRollback, "caso 4: o rollback com um complementar ativo FALHA").not.toBeNull();
    expect.soft(p.caso4.temColunaParte, "caso 4: a coluna parte continua lá").toBe(true);
    expect.soft(p.caso4.depois, "caso 4: os dois registros continuam lá, ativos, com as mesmas partes").toEqual(p.caso4.antes);
  });
});
