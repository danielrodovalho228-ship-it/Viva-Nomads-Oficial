import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { provarA0367, type ProvaDa0367 } from "../fixtures/prova-0367";
import { NO_LABORATORIO } from "../fixtures/laboratorio";

/*
  T1798 — E1225: a caução por bloco (ORDEM-DUET-1120; regra da casa: a trava que afirma comportamento é EXECUTADA num
  banco descartável).
  Parte 1 — a 0367 executada: a própria 0367, o aplicar e o rollback de produção, TAL COMO ESTÃO, corridos num banco
  descartável criado no servidor do laboratório e apagado no fim (tests/e2e/fixtures/prova-0367.ts), sobre
  pagamentos_bloco na forma de ANTES da 0367 e com a massa dos 4 contratos de teste (2 blocos com caução cada; a caução
  de antes registada no contrato pela soma). O índice único passa de "uma caução ativa por contrato" a "uma por bloco",
  e nenhuma linha que já existia muda.
  A trava que lê o texto (tests/migracoes/caucao-por-bloco-0367.test.ts) fica como complemento.
  Laboratório; não é prova ao vivo no site.
*/
const DB = process.env.LAB_DB_URL ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
const MIGRACAO_0367 = readFileSync("supabase/migrations/0367_caucao_por_bloco_e1225.sql", "utf8");
const APLICAR_0367 = readFileSync("supabase/producao/aplicar-0367.sql", "utf8");
const ROLLBACK_0367 = readFileSync("supabase/producao/rollback/0367_rollback.sql", "utf8");

test.describe("T1798 — E1225: a 0367 executada (caução por bloco) @E1225", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ timeout: 180_000 });

  test("a 0367, o aplicar e o rollback corridos de verdade: uma caução por bloco, as linhas de antes intactas, o rollback falha fechado", async () => {
    const p: ProvaDa0367 = await provarA0367(DB, MIGRACAO_0367, APLICAR_0367, ROLLBACK_0367);
    // Asserções brandas: o relatório nomeia TODOS os casos que uma 0367 (ou um rollback) adulterada fere.
    expect.soft(p.migracao.erro, "a 0367 aplica-se sem erro na forma de antes").toBeNull();
    expect.soft(p.migracao.linhas, "a massa: 4 contratos × (a caução de antes + 1 aluguel)").toBe(8);
    expect.soft(p.migracao.linhasDepois, "nenhuma linha que já existia muda (conferência antes/depois)").toBe(p.migracao.linhasAntes);
    expect.soft(p.reaplicar.erro, "reaplicada, sem erro").toBeNull();
    expect.soft(p.reaplicar.linhasIguais, "reaplicada, as linhas não mudam").toBe(true);
    expect.soft(p.reaplicar.indicesIguais, "reaplicada, os índices não mudam").toBe(true);
    expect.soft(p.aplicar.erro1, "o aplicar de produção aplica").toBeNull();
    expect.soft(p.aplicar.erro2, "o aplicar de produção reaplica sem erro").toBeNull();
    expect.soft(p.aplicar.registos, "regista-se uma só vez").toBe(1);
    expect.soft(p.aplicar.nome, "com o nome da migração").toBe("0367_caucao_por_bloco_e1225");
    // Por bloco.
    expect.soft(p.porBloco.erroMigracao).toBeNull();
    expect.soft(p.porBloco.bloco1, "com a caução de antes pela soma, a caução do bloco 1 entra").toBeNull();
    expect.soft(p.porBloco.bloco2, "e a do bloco 2 também (antes, o índice por contrato recusava)").toBeNull();
    expect.soft(p.porBloco.ativasNoContrato, "três cauções ativas no contrato: a de antes e uma por bloco").toBe(3);
    expect.soft(p.mesmoBloco.erroMigracao).toBeNull();
    expect.soft(p.mesmoBloco.segunda, "a 2.ª caução ativa no mesmo bloco é recusada").toMatch(/pagamentos_bloco_uma_caucao_por_bloco|duplicate key/);
    expect.soft(p.mesmoBloco.anular, "a do bloco 1 anula-se").toBeNull();
    expect.soft(p.mesmoBloco.depoisDeAnular, "o anulado não ocupa o bloco: uma nova entra").toBeNull();
    expect.soft(p.mesmoBloco.ativasNoBloco1, "uma só caução ativa no bloco 1").toBe(1);
    expect.soft(p.semBloco.erroMigracao).toBeNull();
    expect.soft(p.semBloco.segundaSemBloco, "duas cauções sem bloco no mesmo contrato: continua recusado").toMatch(/pagamentos_bloco_uma_caucao_sem_bloco|duplicate key/);
    expect.soft(p.aluguelSemBloco.erroMigracao).toBeNull();
    expect.soft(p.aluguelSemBloco.erro, "aluguel sem bloco: continua recusado").toMatch(/pagamentos_bloco_bloco_por_tipo/);
    // A política do dono.
    expect.soft(p.politica.antesDaMigracao, "antes da 0367, a caução com bloco não passava").not.toBeNull();
    expect.soft(p.politica.erroMigracao).toBeNull();
    expect.soft(p.politica.doSeuContrato, "o dono regista a caução num bloco do seu contrato").toBeNull();
    expect.soft(p.politica.deOutroContrato, "num bloco de outro contrato, a política recusa").toMatch(/row-level security|policy/);
    // Rollback.
    expect.soft(p.rollbackComDuas.erroMigracao).toBeNull();
    expect.soft(p.rollbackComDuas.erroRollback, "com duas cauções ativas no mesmo contrato, o rollback FALHA").not.toBeNull();
    expect.soft(p.rollbackComDuas.linhasIguais, "e nada muda nas linhas").toBe(true);
    expect.soft(p.rollbackComDuas.temIndicePorBloco, "o índice por bloco continua").toBe(true);
    expect.soft(p.rollbackComDuas.temIndicePorContrato, "o por contrato não volta").toBe(false);
    expect.soft(p.rollbackLimpo.erroMigracao).toBeNull();
    expect.soft(p.rollbackLimpo.erroRollback, "sem isso, o rollback corre").toBeNull();
    expect.soft(p.rollbackLimpo.linhasIguais, "as linhas ficam").toBe(true);
    expect.soft(p.rollbackLimpo.temIndicePorContrato, "volta o índice por contrato").toBe(true);
    expect.soft(p.rollbackLimpo.temIndicePorBloco, "sai o por bloco").toBe(false);
    expect.soft(p.rollbackLimpo.temIndiceSemBloco, "sai o sem bloco").toBe(false);
    expect.soft(p.rollbackLimpo.registo, "sai o registo da 0367").toBe(0);
  });
});
