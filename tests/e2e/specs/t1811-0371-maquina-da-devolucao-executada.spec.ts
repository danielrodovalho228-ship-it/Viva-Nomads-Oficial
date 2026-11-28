import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { COLUNAS_NOVAS, provarA0371, type ProvaDa0371 } from "../fixtures/prova-0371";
import { NO_LABORATORIO } from "../fixtures/laboratorio";

/*
  T1811 — 0371 @E1248 (ESPEC-E1248 v11, secções 3.6 e 9-A; ORDEM-DUET 1355, decisão 2; regra da casa: a trava que
  afirma comportamento é EXECUTADA num banco descartável). A própria 0371, o aplicar e o rollback de produção, TAL COMO
  ESTÃO, corridos num banco descartável (tests/e2e/fixtures/prova-0371.ts), sobre `caucao_acertos` na forma de ANTES,
  nos três tempos: aplica (as 14 colunas vazias, os dois índices, as regras, a política intacta), reaplica sem efeito,
  e o rollback — com dados nas colunas novas, falha sem mudar nada; limpo, repõe colunas, regras, índices e políticas.
  A trava que lê o texto (tests/migracoes/caucao-acertos-maquina-0371.test.ts) fica como complemento. Laboratório.
*/
const DB = process.env.LAB_DB_URL ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
const MIGRACAO = readFileSync("supabase/migrations/0371_caucao_acertos_maquina_e1248.sql", "utf8");
const APLICAR = readFileSync("supabase/producao/aplicar-0371.sql", "utf8");
const ROLLBACK = readFileSync("supabase/producao/rollback/0371_rollback.sql", "utf8");

const TIPO_HORA = "timestamp with time zone";
const TIPOS: Record<(typeof COLUNAS_NOVAS)[number], string> = {
  aviso_em: TIPO_HORA, lembrete_em: TIPO_HORA, confirmacao_via: "text", contestacao_motivo: "text", contestado_em: TIPO_HORA,
  chamado_id: "uuid", central_decisao: "text", central_decidido_em: TIPO_HORA, central_decidido_por: "uuid", central_motivo: "text",
  comprovante_path: "text", comprovante_pedido_em: TIPO_HORA, comprovante_anexado_em: TIPO_HORA, comprovante_lembrete_em: TIPO_HORA,
};

test.describe("T1811 — 0371 executada: a máquina da devolução da caução @E1248", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ timeout: 120_000 });

  test("a 0371, o aplicar e o rollback corridos de verdade, nos três tempos", async () => {
    const p: ProvaDa0371 = await provarA0371(DB, MIGRACAO, APLICAR, ROLLBACK);
    // 1. aplica
    expect.soft(p.aplica.erroMigracao, "a 0371 aplica-se sem erro").toBeNull();
    expect.soft(p.aplica.erro, "o aplicar corre sem erro").toBeNull();
    expect.soft(p.aplica.iguais, "os acertos que existiam ficam iguais").toBe(true);
    expect.soft(p.aplica.vazias, "as colunas novas nascem vazias").toBe(true);
    expect.soft(p.aplica.tipos, "as 14 colunas, com o tipo certo").toEqual(TIPOS);
    expect.soft(p.aplica.indices.sort(), "os dois índices da rotina de hora a hora").toEqual(["caucao_acertos_comprovante_pendente_idx", "caucao_acertos_espera_aviso_idx"]);
    expect.soft(p.aplica.politicasIguais, "a política dos acertos fica como estava").toBe(true);
    expect.soft(p.aplica.rls, "a RLS continua ligada").toBe(true);
    // 2. reaplica
    expect.soft(p.reaplica.erroMigracao, "a 0371 reaplica-se sem erro").toBeNull();
    expect.soft(p.reaplica.erro, "o aplicar reaplica-se sem erro").toBeNull();
    expect.soft(p.reaplica.mesmoRetrato, "reaplicar não muda colunas, regras, índices nem políticas").toBe(true);
    expect.soft(p.reaplica.registos, "o registo fica uma vez").toBe(1);
    expect.soft(p.reaplica.nome).toBe("0371_caucao_acertos_maquina_e1248");
    // as regras
    for (const [caso, erro] of Object.entries(p.regras.aceites)) expect.soft(erro, `aceite: ${caso}`).toBeNull();
    for (const [caso, erro] of Object.entries(p.regras.recusadas)) expect.soft(erro, `recusada: ${caso}`).not.toBeNull();
    // 3. rollback
    expect.soft(p.rollbackComDados.erro, "com dados nas colunas novas, o rollback falha").toContain("0371");
    expect.soft(p.rollbackComDados.colunas, "e as 14 colunas ficam").toBe(14);
    expect.soft(p.rollbackComDados.registo, "e o registo fica").toBe(1);
    expect.soft(p.rollbackComDados.dadoFica, "e nada muda (o dado, as colunas, as regras, os índices, as políticas)").toBe(true);
    expect.soft(p.rollback.erro, "o rollback limpo corre").toBeNull();
    expect.soft(p.rollback.colunasIguais, "repõe as colunas").toBe(true);
    expect.soft(p.rollback.regrasIguais, "repõe as regras").toBe(true);
    expect.soft(p.rollback.indicesIguais, "repõe os índices").toBe(true);
    expect.soft(p.rollback.politicasIguais, "repõe as políticas").toBe(true);
    expect.soft(p.rollback.registo, "tira o registo").toBe(0);
    expect.soft(p.aplicaDeNovo.erro, "aplica de novo depois do rollback").toBeNull();
    expect.soft(p.aplicaDeNovo.colunas).toBe(14);
  });
});
