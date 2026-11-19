/* Roda: node --test src/lib/anuncio/e614-retoma-sem-carimbo.test.ts */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { autosaveSemNadaAGravar, copiaLocalCarimbada, rascunhoCarimbado, rascunhoComHoraConhecida, salvoAsDoRascunho } from "./salvo-fantasma.ts";

/*
  E614 (ORDEM-DUET-137, 18/11/2026) — a trava t2140 passava no laboratório e a produção reabria o rascunho sem
  "Salvo às HH:MM". Causas, todas fora do que a t2140 exercita (ela reabre um rascunho completo que ela própria acabou
  de gravar com o código novo):
   1. rascunho sem carimbo (`salvoEm`): todos os anteriores à regra — os 39 de produção — reabriam sem indicador;
   2. o rascunho criado ao sair da Qualificação ("Começar o cadastro", "Salvar e sair") nascia sem carimbo;
   3. num rascunho ainda sem conteúdo (só o tipo), o autosave desistia antes de gravar: nem o passo nem o carimbo
      chegavam ao servidor, e a retoma voltava ao Passo 1;
   4. a cópia do navegador (a outra fonte da retoma) nunca levava carimbo.
  Recurso decidido pelo Gerente (ORDEM-DUET-139/140): `salvoEm`; na falta, `properties.updated_at` (migração 0346).
*/
const SP = "America/Sao_Paulo";
const ATUALIZADO = "2026-11-16T14:07:00.000Z"; // 11:07 em Brasília
const CRIADO = "2026-11-14T20:42:13.655Z"; // 17:42 em Brasília

test("causa 1 — rascunho sem carimbo: vale a hora da última gravação da linha (updated_at)", () => {
  const d = rascunhoComHoraConhecida({ title: "Casa", step: 1 }, ATUALIZADO, CRIADO) as Record<string, unknown>;
  assert.equal(d.salvoEm, ATUALIZADO);
  assert.equal(salvoAsDoRascunho(d, SP), "11:07");
  assert.equal(d.title, "Casa");
  assert.equal(d.step, 1);
});

test("causa 1 — linha ainda não regravada depois da 0346 (updated_at nulo): vale a hora da criação", () => {
  for (const semHora of [null, undefined, "", "sem data"]) {
    const d = rascunhoComHoraConhecida({ title: "Casa" }, semHora, CRIADO) as Record<string, unknown>;
    assert.equal(salvoAsDoRascunho(d, SP), "17:42", `updated_at = ${JSON.stringify(semHora)}`);
  }
});

test("causa 1 — carimbo válido vence a linha: é a hora da ÚLTIMA gravação do rascunho", () => {
  const d = rascunhoComHoraConhecida({ salvoEm: "2026-11-18T23:05:00.000Z" }, ATUALIZADO, CRIADO) as Record<string, unknown>;
  assert.equal(salvoAsDoRascunho(d, SP), "20:05");
});

test("causa 1 — carimbo inválido conta como ausente; sem hora nenhuma, o rascunho segue como veio", () => {
  for (const ruim of [123, "", "ontem", null]) {
    const d = rascunhoComHoraConhecida({ salvoEm: ruim }, ATUALIZADO, CRIADO) as Record<string, unknown>;
    assert.equal(salvoAsDoRascunho(d, SP), "11:07", `salvoEm = ${JSON.stringify(ruim)}`);
  }
  assert.deepEqual(rascunhoComHoraConhecida({ title: "Casa" }, null, null), { title: "Casa" });
  assert.deepEqual(rascunhoComHoraConhecida({ title: "Casa" }, "sem data"), { title: "Casa" });
  assert.equal(rascunhoComHoraConhecida(null, ATUALIZADO, CRIADO), null);
});

test("causa 1 — abrir não muda o rascunho gravado: a função devolve uma cópia", () => {
  const original = { title: "Casa" };
  rascunhoComHoraConhecida(original, ATUALIZADO, CRIADO);
  assert.deepEqual(original, { title: "Casa" });
});

test("causa 2 — toda gravação do rascunho sai carimbada do servidor, venha de onde vier", () => {
  const agora = new Date("2026-11-19T00:18:42.000Z");
  const novo = rascunhoCarimbado({ title: "", step: 0 }, agora) as Record<string, unknown>;
  assert.equal(novo.salvoEm, "2026-11-19T00:18:42.000Z");
  assert.equal(novo.step, 0);
  // O carimbo que a tela já manda (autosave) fica como veio.
  assert.equal((rascunhoCarimbado({ salvoEm: "2026-11-18T23:05:00.000Z" }, agora) as Record<string, unknown>).salvoEm, "2026-11-18T23:05:00.000Z");
  // Carimbo inválido é trocado; o que não é objeto passa como veio.
  assert.equal((rascunhoCarimbado({ salvoEm: "ontem" }, agora) as Record<string, unknown>).salvoEm, "2026-11-19T00:18:42.000Z");
  assert.equal(rascunhoCarimbado(null, agora), null);
  assert.deepEqual(rascunhoCarimbado([1], agora), [1]);
});

test("causa 3 — rascunho sem conteúdo: só não grava enquanto ainda não existe no servidor", () => {
  assert.equal(autosaveSemNadaAGravar({ vazio: true, rascunhoNoServidor: false }), true);
  assert.equal(autosaveSemNadaAGravar({ vazio: true, rascunhoNoServidor: true }), false);
  assert.equal(autosaveSemNadaAGravar({ vazio: false, rascunhoNoServidor: false }), false);
  assert.equal(autosaveSemNadaAGravar({ vazio: false, rascunhoNoServidor: true }), false);
});

test("causa 4 — a cópia do navegador leva a hora; com o mesmo conteúdo, fica como estava (reabrir não carimba)", () => {
  const json = JSON.stringify({ title: "Casa", step: 1 });
  const t1 = new Date("2026-11-19T00:18:42.000Z");
  const primeira = copiaLocalCarimbada(json, null, t1);
  assert.deepEqual(JSON.parse(primeira), { title: "Casa", step: 1, salvoEm: "2026-11-19T00:18:42.000Z" });
  assert.equal(salvoAsDoRascunho(JSON.parse(primeira), SP), "21:18");
  // Mesmo conteúdo, mais tarde: a cópia e a hora ficam como estavam.
  assert.equal(copiaLocalCarimbada(json, primeira, new Date("2026-11-19T03:00:00.000Z")), primeira);
  // Conteúdo novo (ou só o passo): hora nova.
  const outra = copiaLocalCarimbada(JSON.stringify({ title: "Casa", step: 2 }), primeira, new Date("2026-11-19T03:00:00.000Z"));
  assert.equal(JSON.parse(outra).salvoEm, "2026-11-19T03:00:00.000Z");
  // Cópia antiga sem hora, ou ilegível: carimba a de agora; JSON que não é objeto passa como veio.
  assert.equal(JSON.parse(copiaLocalCarimbada(json, json, t1)).salvoEm, "2026-11-19T00:18:42.000Z");
  assert.equal(JSON.parse(copiaLocalCarimbada(json, "{quebrado", t1)).salvoEm, "2026-11-19T00:18:42.000Z");
  assert.equal(copiaLocalCarimbada("[1]", null, t1), "[1]");
  assert.equal(copiaLocalCarimbada("{quebrado", null, t1), "{quebrado");
});

test("as correções estão ligadas onde o rascunho abre, grava e decide gravar", () => {
  const acoes = readFileSync("src/lib/data/actions.ts", "utf8");
  const abrir = acoes.slice(acoes.indexOf("export async function abrirRascunho"), acoes.indexOf("async function semFotosApagadas"));
  assert.match(abrir, /\.select\("updated_at, created_at"\)\.eq\("id", id\)\.eq\("owner_id", user\.id\)/);
  assert.match(abrir, /row\.draft_data = rascunhoComHoraConhecida\(row\.draft_data \?\? null, linha\?\.updated_at \?\? null, linha\?\.created_at \?\? null\);\s+return \{ ok: true, draft: await semFotosApagadas\(row\.draft_data \?\? null, user\.id\) \};/);
  // Abrir só lê: nenhuma gravação dentro de abrirRascunho.
  assert.doesNotMatch(abrir, /\.(update|insert|upsert|delete)\(/);
  const gravar = acoes.slice(acoes.indexOf("export async function saveDraftData"), acoes.indexOf("async function sincronizarFotos"));
  assert.match(gravar, /draft_data: rascunhoCarimbado\(snap\.data, new Date\(\)\) as object,/);
  const pagina = readFileSync("src/app/(dashboard)/dashboard/imoveis/novo/page.tsx", "utf8");
  const efeito = pagina.slice(pagina.indexOf("// Auto-save do rascunho"), pagina.indexOf("// Limites privados do rascunho"));
  assert.match(efeito, /if \(autosaveSemNadaAGravar\(\{ vazio, rascunhoNoServidor: !!draftIdRef\.current \}\)\) return;/);
  assert.doesNotMatch(efeito, /if \(vazio\) return;/);
  assert.match(efeito, /localStorage\.setItem\(draftKey\(userId\), copiaLocalCarimbada\(draftJson, localStorage\.getItem\(draftKey\(userId\)\), new Date\(\)\)\);/);
});

test("migração 0346: coluna, gatilho que respeita a hora gravada de propósito, grant; produção idempotente e com rollback", () => {
  const m = readFileSync("supabase/migrations/0346_properties_updated_at_e614.sql", "utf8");
  assert.match(m, /alter table public\.properties add column if not exists updated_at timestamptz;/);
  assert.match(m, /if new\.updated_at is not distinct from old\.updated_at then\s+new\.updated_at := now\(\);/);
  assert.match(m, /before update on public\.properties\s+for each row execute function public\.properties_carimbar_updated_at\(\);/);
  assert.match(m, /grant select \(updated_at\) on public\.properties to anon, authenticated;/);
  // Nenhuma linha existente é regravada pela migração (sem UPDATE em massa: os outros gatilhos da tabela não disparam).
  assert.doesNotMatch(m.replace(/--.*$/gm, ""), /\bupdate\s+public\.properties\b/i);
  const p = readFileSync("supabase/producao/aplicar-0346.sql", "utf8");
  const corpo = p.replace(/--.*$/gm, "");
  assert.match(corpo, /^\s*begin;/);
  assert.match(corpo, /commit;\s*$/);
  assert.match(p, /select '20261118000346', '0346_properties_updated_at_e614'\s+where not exists \(select 1 from supabase_migrations\.schema_migrations where version = '20261118000346'\);/);
  assert.doesNotMatch(corpo, /\bupdate\s+public\.properties\b/i);
  // Sem NOTICE na 2ª aplicação: nada de "if not exists"/"if exists" solto fora dos blocos que conferem o catálogo.
  assert.doesNotMatch(corpo, /add column if not exists|drop trigger if exists/);
  const r = readFileSync("supabase/producao/rollback/0346_rollback.sql", "utf8");
  assert.match(r, /drop trigger if exists properties_updated_at on public\.properties;/);
  assert.match(r, /alter table public\.properties drop column if exists updated_at;/);
  assert.match(r, /delete from supabase_migrations\.schema_migrations where version = '20261118000346';/);
});
