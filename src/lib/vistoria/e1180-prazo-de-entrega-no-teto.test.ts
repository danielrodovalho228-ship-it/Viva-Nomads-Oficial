/*
  E1180 (ORDENS-DUET 824 e 835; endurecimento). O avaliador declara no credenciamento em quantos dias entrega o laudo
  (avaliadores_credenciamento.prazo_entrega_dias). A aplicação só deixa de 1 a 5 (o teto da regra dos dias úteis, E1156);
  a base ainda aceitava de 1 a 30, a regra antiga da migração 0325. Quem escrevesse direto na base, ou um código futuro
  que se esquecesse da validação, guardava um prazo que a aplicação não reconhece.
  A cura: a migração 0364 troca só a regra da coluna, de 1–30 para 1–5. Nenhum dado é alterado; se existir alguma linha
  acima do teto, a troca não se faz e nada muda.
  Roda: node --test src/lib/vistoria/e1180-prazo-de-entrega-no-teto.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { validarTermos } from "./escolha.ts";
import { PRAZO_LAUDO_MAX_DIAS_UTEIS } from "./prazos.ts";

const MIGRACOES = "supabase/migrations";
const REGRA = "avaliadores_credenciamento_prazo_entrega_dias_check";
const NOME = "0364_avaliador_prazo_de_entrega_no_teto_e1180";
const VERSAO = "20261125000364";
/** Sem as linhas de comentário: os comentários contam a história (falam do 1–30), a regra está no SQL. */
const sql = (caminho: string) =>
  readFileSync(caminho, "utf8")
    .split("\n")
    .filter((l) => !l.trimStart().startsWith("--"))
    .join("\n");
const TROCA = new RegExp(
  `alter table public\\.avaliadores_credenciamento\\s+drop constraint if exists ${REGRA},\\s+add constraint ${REGRA}\\s+check \\(prazo_entrega_dias is null or prazo_entrega_dias between 1 and (\\d+)\\);`,
);

/** O teto do prazo de entrega em vigor na base: a última migração que define a regra da coluna. */
function tetoEmVigor(): { arquivo: string; teto: number } {
  let achado: { arquivo: string; teto: number } | null = null;
  for (const arquivo of readdirSync(MIGRACOES).filter((f) => f.endsWith(".sql")).sort()) {
    for (const m of sql(`${MIGRACOES}/${arquivo}`).matchAll(/check \(prazo_entrega_dias is null or prazo_entrega_dias between 1 and (\d+)\)/g)) achado = { arquivo, teto: Number(m[1]) };
  }
  assert.ok(achado, "nenhuma migração define a regra do prazo de entrega");
  return achado;
}

test("E1180 (1): a regra em vigor na base é o teto da aplicação — de 1 a 5 dias", () => {
  assert.equal(PRAZO_LAUDO_MAX_DIAS_UTEIS, 5);
  const { arquivo, teto } = tetoEmVigor();
  assert.equal(teto, PRAZO_LAUDO_MAX_DIAS_UTEIS, `a base aceita prazo de entrega até ${teto} dias (${arquivo}); a aplicação só deixa até ${PRAZO_LAUDO_MAX_DIAS_UTEIS}`);
  assert.equal(arquivo, `${NOME}.sql`);
});

test("E1180 (2): a aplicação e a base recusam o mesmo — 5 passa, 6 não", () => {
  assert.equal(validarTermos({ valor: 300, prazoEntregaDias: PRAZO_LAUDO_MAX_DIAS_UTEIS, prazoRespostaHoras: 12 }).ok, true);
  assert.equal(validarTermos({ valor: 300, prazoEntregaDias: PRAZO_LAUDO_MAX_DIAS_UTEIS + 1, prazoRespostaHoras: 12 }).ok, false);
  assert.equal(tetoEmVigor().teto + 1, PRAZO_LAUDO_MAX_DIAS_UTEIS + 1);
});

test("E1180 (3): a migração 0364 só troca a regra — numa instrução só, sem tocar em dado nenhum", () => {
  const m = sql(`${MIGRACOES}/${NOME}.sql`);
  // Tirar a regra antiga e pôr a nova na MESMA instrução: se alguma linha estiver acima do teto, nada muda.
  assert.equal(TROCA.exec(m)?.[1], String(PRAZO_LAUDO_MAX_DIAS_UTEIS));
  assert.doesNotMatch(m, /\b(update|delete|insert|truncate)\b/i, "a migração não altera dados");
  assert.doesNotMatch(m, /not valid/i, "a regra vale para as linhas que já existem");
  // A outra coluna com 1–30 (o prazo proposto no pedido) fica de fora: os pedidos antigos podem ter mais de 5.
  assert.doesNotMatch(m, /prazo_proposto_dias|vistoria_pedidos/);
});

test("E1180 (4): o aplicar é idempotente, numa transação, e regista-se; o rollback volta ao 1–30", () => {
  const a = sql("supabase/producao/aplicar-0364.sql");
  assert.match(a, /^begin;$/m);
  assert.match(a, /^commit;$/m);
  assert.equal(TROCA.exec(a)?.[1], String(PRAZO_LAUDO_MAX_DIAS_UTEIS));
  assert.match(a, new RegExp(`select '${VERSAO}', '${NOME}'\\s+where not exists \\(select 1 from supabase_migrations\\.schema_migrations where version = '${VERSAO}'\\);`));
  assert.doesNotMatch(a, /\b(update|delete|truncate)\b/i, "o aplicar não altera dados");
  const r = sql("supabase/producao/rollback/0364_rollback.sql");
  assert.match(r, /^begin;$/m);
  assert.match(r, /^commit;$/m);
  assert.equal(TROCA.exec(r)?.[1], "30");
  assert.match(r, new RegExp(`delete from supabase_migrations\\.schema_migrations where version = '${VERSAO}';`));
});
