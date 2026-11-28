import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { provarA0370, type ProvaDa0370 } from "../fixtures/prova-0370";
import { NO_LABORATORIO } from "../fixtures/laboratorio";

/*
  T1802 — 0370 @E1240 (ESPEC-E1240 v5, secção 5.1; ORDEM-DUET 1324; regra da casa: a trava que afirma comportamento é
  EXECUTADA num banco descartável). A própria 0370, o aplicar e o rollback de produção, TAL COMO ESTÃO, corridos num
  banco descartável (tests/e2e/fixtures/prova-0370.ts), sobre `contratos_checkin` na forma de ANTES: aplica sem mexer
  na linha, reaplica sem efeito, a regra do formato morde, a hora de entrada e o acesso ficam como estavam, o envio sem
  a coluna não toca na hora de saída e o vazio apaga-a; o rollback com uma hora gravada falha sem mudar nada, e sem
  horas tira a coluna, a regra e o registo; depois, aplica de novo. A trava que lê o texto
  (tests/migracoes/horario-saida-0370.test.ts) fica como complemento. Laboratório; não é prova ao vivo no site.
*/
const DB = process.env.LAB_DB_URL ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
const MIGRACAO = readFileSync("supabase/migrations/0370_contratos_checkin_horario_saida_e1240.sql", "utf8");
const APLICAR = readFileSync("supabase/producao/aplicar-0370.sql", "utf8");
const ROLLBACK = readFileSync("supabase/producao/rollback/0370_rollback.sql", "utf8");

test.describe("T1802 — 0370 executada: a hora de saída das instruções @E1240", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ timeout: 120_000 });

  test("a 0370, o aplicar e o rollback corridos de verdade", async () => {
    const p: ProvaDa0370 = await provarA0370(DB, MIGRACAO, APLICAR, ROLLBACK);
    // 1. aplica
    expect.soft(p.aplica.erroMigracao, "1. a 0370 aplica-se sem erro").toBeNull();
    expect.soft(p.aplica.erro, "1. o aplicar corre sem erro").toBeNull();
    expect.soft(p.aplica.iguais, "1. a linha que existia fica igual").toBe(true);
    expect.soft(p.aplica.vazia, "1. com a coluna nova vazia").toBe(true);
    expect.soft(p.aplica.tipo, "1. a coluna é texto").toBe("text");
    expect.soft(p.aplica.padrao, "1. sem valor por omissão").toBeNull();
    // 2. reaplica
    expect.soft(p.reaplica.erroMigracao, "2. a 0370 reaplica-se sem erro").toBeNull();
    expect.soft(p.reaplica.erro, "2. o aplicar reaplica-se sem erro").toBeNull();
    expect.soft(p.reaplica.registos, "2. o registo fica uma vez").toBe(1);
    expect.soft(p.reaplica.nome).toBe("0370_contratos_checkin_horario_saida_e1240");
    // 3. a regra morde
    expect.soft(p.regra.aceites, "3. \"11:00\" e o vazio entram").toEqual({ "11:00": null, vazio: null });
    for (const [v, erro] of Object.entries(p.regra.recusadas)) expect.soft(erro, `3. "${v}" é recusado pela regra`).toContain("contratos_checkin_horario_saida_fmt");
    // 4. a hora de entrada não mexe
    expect.soft(p.entrada.colunaIgual, "4. a coluna da hora de entrada fica como estava").toBe(true);
    expect.soft(p.entrada.regraIgual, "4. a regra da hora de entrada fica como estava").toBe(true);
    // 5. o acesso não abriu
    expect.soft(p.acesso.tabela, "5. authenticated continua sem ler a tabela").toBe(false);
    expect.soft(p.acesso.coluna, "5. nem a coluna nova").toBe(false);
    expect.soft(p.acesso.rls, "5. a RLS continua ligada").toBe(true);
    // 9 e 10. ausente não toca; vazio apaga
    expect.soft(p.semAColuna.erro).toBeNull();
    expect.soft(p.semAColuna.hora, "9. gravar a linha sem a coluna nova: a hora de saída fica").toBe("11:00");
    expect.soft(p.comAColunaVazia.erro).toBeNull();
    expect.soft(p.comAColunaVazia.hora, "10. gravar a linha com a coluna vazia: a hora é apagada").toBeNull();
    // 7. o rollback com uma hora gravada falha sem mudar nada
    expect.soft(p.rollbackComHora.erro, "7. o rollback com uma hora gravada falha").toContain("0370");
    expect.soft(p.rollbackComHora.coluna, "7. a coluna fica").toBe(true);
    expect.soft(p.rollbackComHora.regra, "7. a regra fica").toBe(true);
    expect.soft(p.rollbackComHora.registo, "7. o registo fica").toBe(1);
    expect.soft(p.rollbackComHora.hora, "7. a hora gravada fica").toBe("11:00");
    // 6. o rollback sem horas
    expect.soft(p.rollbackSemHora.erro, "6. o rollback sem horas corre").toBeNull();
    expect.soft(p.rollbackSemHora.coluna, "6. sai a coluna").toBe(false);
    expect.soft(p.rollbackSemHora.regra, "6. sai a regra").toBe(false);
    expect.soft(p.rollbackSemHora.registo, "6. sai o registo").toBe(0);
    expect.soft(p.rollbackSemHora.formaDeAntes, "6. a tabela volta à forma de antes").toBe(true);
    // 8. aplica de novo
    expect.soft(p.aplicaDeNovo.erro, "8. aplica de novo depois do rollback").toBeNull();
    expect.soft(p.aplicaDeNovo.coluna).toBe(true);
  });
});
