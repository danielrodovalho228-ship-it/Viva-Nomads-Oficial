import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fonteSemComentarios as semComentarios } from "../fonte-sem-comentarios.ts";
import { ROTULO_FILA } from "./rotulos-da-fila.ts";

/*
  E1179 (ORDENS-DUET 780 e 788; linha Parceiros). Desde a migração 0313 a regra `vistoria_fila_admin_tipo_check` deixou
  de aceitar quatro tipos da fila da equipe: laudo_atrasado, ressalva_vencida, devolucao_vencida e seguranca_grave. A
  rotina continuou a gravá-los, o banco recusava, e ninguém via: o item nunca chegava à "Fila da equipe".
  A migração 0363 devolve os quatro tipos à regra. Esta trava impede a volta do defeito: a ÚLTIMA definição da regra,
  na ordem das migrações, tem de aceitar todo tipo que o código grava e todo tipo que a tela sabe rotular.
  Roda: node --test src/lib/vistoria/e1179-fila-aceita-os-tipos-do-laudo.test.ts
*/
const MIGRACOES = "supabase/migrations";
const REGRA = /add constraint vistoria_fila_admin_tipo_check\s+check\s*\(\s*tipo in \(([^)]*)\)/g;
const tiposDe = (sql: string): string[] | null => {
  const todas = [...sql.matchAll(REGRA)];
  return todas.length ? [...todas[todas.length - 1][1].matchAll(/'([a-z_]+)'/g)].map((m) => m[1]) : null;
};
/** Os tipos que a regra aceita depois de todas as migrações, na ordem em que elas são aplicadas. */
function tiposAceitos(): { arquivo: string; tipos: string[] } {
  let ultima: { arquivo: string; tipos: string[] } | null = null;
  for (const arquivo of readdirSync(MIGRACOES).filter((f) => f.endsWith(".sql")).sort()) {
    const tipos = tiposDe(readFileSync(join(MIGRACOES, arquivo), "utf8"));
    if (tipos) ultima = { arquivo, tipos };
  }
  assert.ok(ultima, "nenhuma migração define a regra dos tipos da fila");
  return ultima;
}
const OS_QUATRO = ["laudo_atrasado", "ressalva_vencida", "devolucao_vencida", "seguranca_grave"];
const OS_DE_ANTES = ["sem_avaliador", "avaliacao_teste", "suspensao_automatica", "proposta_descredenciamento", "revisao_criterio", "contestacao_sem_avaliador"];

test("E1179 (1): a regra em vigor aceita os quatro tipos do laudo, sem perder nenhum dos seis de antes", () => {
  const { arquivo, tipos } = tiposAceitos();
  for (const t of OS_QUATRO) assert.ok(tipos.includes(t), `${arquivo} recusa ${t}`);
  for (const t of OS_DE_ANTES) assert.ok(tipos.includes(t), `${arquivo} perdeu ${t}`);
  assert.equal(new Set(tipos).size, tipos.length, "tipo repetido na regra");
});

test("E1179 (2): todo tipo que o código grava na fila é aceito pela regra em vigor", () => {
  const { arquivo, tipos } = tiposAceitos();
  const gravados = new Set<string>();
  // As gravações diretas: .from("vistoria_fila_admin").insert({ tipo: "…" … }).
  for (const f of ["src/lib/vistoria/laudo-servidor.ts", "src/lib/vistoria/servidor.ts", "src/lib/vistoria/actions.ts", "src/lib/vistoria/ativacao-automatica-servidor.ts"]) {
    for (const m of semComentarios(readFileSync(f, "utf8")).matchAll(/from\("vistoria_fila_admin"\)\.insert\(\{\s*tipo: "([a-z_]+)"/g)) gravados.add(m[1]);
  }
  // As gravações pela função da fila: o tipo dela é uma união fechada de textos.
  const servidor = semComentarios(readFileSync("src/lib/vistoria/servidor.ts", "utf8"));
  const uniao = /async function naFilaDoAdmin\(\s*admin: Admin,\s*tipo: ([^,]+),/.exec(servidor);
  assert.ok(uniao, "não achei a função da fila");
  for (const m of uniao[1].matchAll(/"([a-z_]+)"/g)) gravados.add(m[1]);
  // As três gravações da rotina do laudo estão mesmo no código (se saírem, esta trava deixa de as vigiar).
  for (const t of ["laudo_atrasado", "ressalva_vencida", "devolucao_vencida"]) assert.ok(gravados.has(t), `a rotina deixou de gravar ${t}?`);
  for (const t of gravados) assert.ok(tipos.includes(t), `o código grava "${t}", e ${arquivo} recusa`);
});

test("E1179 (3): todo tipo que a tela sabe rotular é aceito pela regra — e a regra não aceita tipo sem rótulo", () => {
  const { arquivo, tipos } = tiposAceitos();
  for (const t of Object.keys(ROTULO_FILA)) assert.ok(tipos.includes(t), `a tela rotula "${t}", e ${arquivo} recusa`);
  for (const t of tipos) assert.ok(ROTULO_FILA[t], `${arquivo} aceita "${t}", que a tela não sabe rotular`);
});

test("E1179 (4): a migração 0363 só troca a regra — e tem o aplicar idempotente e o rollback", () => {
  const nome = "0363_vistoria_fila_admin_tipos_do_laudo_e1179";
  const mig = readFileSync(join(MIGRACOES, `${nome}.sql`), "utf8");
  assert.equal(tiposAceitos().arquivo, `${nome}.sql`, "a regra em vigor é a da 0363");
  assert.match(mig, /alter table public\.vistoria_fila_admin drop constraint if exists vistoria_fila_admin_tipo_check;/);
  assert.doesNotMatch(mig, /\badd column\b|\bdrop column\b|\bdelete\b|\btruncate\b|\bupdate\b|\binsert\b/i, "só a regra: nenhum dado, nenhuma coluna");
  const aplicar = readFileSync("supabase/producao/aplicar-0363.sql", "utf8");
  assert.match(aplicar, /^begin;/m);
  assert.match(aplicar, /commit;\s*$/);
  assert.match(aplicar, /drop constraint if exists vistoria_fila_admin_tipo_check/);
  assert.deepEqual(tiposDe(aplicar), tiposDe(mig), "o aplicar e a migração dizem a mesma regra");
  assert.match(aplicar, new RegExp(`'20261124000363', '${nome}'`));
  assert.match(aplicar, /where not exists \(select 1 from supabase_migrations\.schema_migrations where version = '20261124000363'\)/);
  const volta = readFileSync("supabase/producao/rollback/0363_rollback.sql", "utf8");
  assert.deepEqual(tiposDe(volta), OS_DE_ANTES, "o rollback volta à regra da 0362");
  assert.match(volta, /delete from supabase_migrations\.schema_migrations where version = '20261124000363'/);
});
