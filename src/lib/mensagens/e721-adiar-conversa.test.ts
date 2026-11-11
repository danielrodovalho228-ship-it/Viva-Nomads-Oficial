/*
  E721 — "Adiar" a conversa em /dashboard/mensagens. Roda: node --test src/lib/mensagens/e721-adiar-conversa.test.ts
  O "adiar" do E721 original era o do push (42P10, 0332); a ação da pessoa sobre a conversa nunca existiu na tela.
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PRAZOS_ADIAR, adiarAte, estaAdiada, separarAdiadas, contarPorFiltro, filtrarConversas } from "../mensagens-filtros.ts";

const ler = (p: string) => readFileSync(new URL(`../../../${p}`, import.meta.url), "utf8");
const AGORA = new Date("2026-11-10T12:00:00Z");

test("prazos: 1 dia, 3 dias e 1 semana, a partir de agora", () => {
  assert.deepEqual(PRAZOS_ADIAR.map((p) => p.id), ["1d", "3d", "7d"]);
  assert.equal(adiarAte("1d", AGORA), "2026-11-11T12:00:00.000Z");
  assert.equal(adiarAte("7d", AGORA), "2026-11-17T12:00:00.000Z");
  assert.equal(adiarAte("9d" as never, AGORA), null);
});

test("adiada: dentro do prazo e sem mensagem nova da outra parte", () => {
  const c = { adiadaEm: "2026-11-10T11:00:00Z", adiadaAte: "2026-11-11T11:00:00Z", messages: [{ from: "them" as const, enviadaEm: "2026-11-10T10:00:00Z" }, { from: "me" as const, enviadaEm: "2026-11-10T11:30:00Z" }] };
  assert.equal(estaAdiada(c, AGORA), true);
});

test("a adiada volta quando o prazo acaba ou quando a outra parte escreve depois de adiar", () => {
  const base = { adiadaEm: "2026-11-10T11:00:00Z", adiadaAte: "2026-11-11T11:00:00Z" };
  assert.equal(estaAdiada({ ...base, messages: [{ from: "them", enviadaEm: "2026-11-10T11:30:00Z" }] }, AGORA), false);
  assert.equal(estaAdiada({ ...base, messages: [] }, new Date("2026-11-11T11:00:01Z")), false);
  assert.equal(estaAdiada({ messages: [] }, AGORA), false);
});

test("a adiada sai de Todas e dos chips de papel e vai para Adiadas; cada lado vê só a sua", () => {
  const lista = [
    { id: "a", papel: "inquilino" as const, adiadaEm: "2026-11-10T11:00:00Z", adiadaAte: "2026-11-12T11:00:00Z", messages: [] },
    { id: "b", papel: "inquilino" as const, messages: [] },
  ];
  const { ativas, adiadas } = separarAdiadas(lista, AGORA);
  assert.deepEqual(adiadas.map((c) => c.id), ["a"]);
  assert.deepEqual(ativas.map((c) => c.id), ["b"]);
  assert.equal(contarPorFiltro(ativas).todas, 1);
  assert.equal(filtrarConversas(ativas, "inquilino").length, 1);
});

test("a migração 0336 cria a tabela por pessoa+conversa com RLS própria, e o aplicar/rollback acompanham", () => {
  const sql = ler("supabase/migrations/0336_conversas_adiadas_e721.sql").replace(/^\s*--.*$/gm, "");
  assert.match(sql, /create table if not exists public\.conversas_adiadas/);
  assert.match(sql, /primary key \(user_id, conversation_id\)/);
  assert.match(sql, /enable row level security/);
  assert.match(sql, /for insert to authenticated[\s\S]*?user_id = auth\.uid\(\)[\s\S]*?from public\.messages/);
  assert.doesNotMatch(sql, /\b(delete|update)\s+(from\s+)?public\.messages/i);
  assert.match(ler("supabase/producao/aplicar-0336.sql"), /'20261107000336', '0336_conversas_adiadas_e721'/);
  assert.match(ler("supabase/producao/rollback/0336_rollback.sql"), /drop table if exists public\.conversas_adiadas/);
});

test("o servidor grava a linha da própria pessoa sem upsert, e só atualiza colunas que a 0336 concede (devolução do QA, 10/11)", () => {
  const a = ler("src/lib/data/conversa-adiar-actions.ts");
  const sql = ler("supabase/migrations/0336_conversas_adiadas_e721.sql").replace(/^\s*--.*$/gm, "");
  // O upsert vira INSERT … ON CONFLICT DO UPDATE SET com TODAS as colunas: com grant de coluna estreito, o Postgres recusa.
  assert.doesNotMatch(a.replace(/^\s*\/\/.*$/gm, ""), /\.upsert\(/);
  // As colunas que a ação manda no UPDATE ⊆ as colunas do grant update da migração.
  const grant = /grant update \(([^)]+)\) on public\.conversas_adiadas to authenticated;/.exec(sql);
  assert.ok(grant, "grant update de colunas da 0336");
  const permitidas = new Set(grant![1].split(",").map((c) => c.trim()));
  const updates = [...a.matchAll(/\.update\(\{([^}]*)\}\)/g)];
  assert.ok(updates.length >= 1, "a ação atualiza por update");
  for (const u of updates) {
    const colunas = u[1].split(",").map((c) => c.split(":")[0].trim()).filter(Boolean);
    for (const c of colunas) assert.ok(permitidas.has(c), `a ação atualiza '${c}', fora do grant (${[...permitidas].join(", ")})`);
  }
  // Primeira vez: insert (a policy de insert exige ser parte da conversa); corrida (23505): atualiza de novo.
  assert.match(a, /\.eq\("user_id", user\.id\)\s*\.eq\("conversation_id", conversationId\)/);
  assert.match(a, /\.insert\(\{ user_id: user\.id, conversation_id: conversationId, adiada_em: adiadaEm, ate \}\)/);
  assert.match(a, /novo\.error\.code !== "23505"/);
  assert.match(a, /\.delete\(\)\.eq\("user_id", user\.id\)\.eq\("conversation_id", conversationId\)/);
  // A chave da tabela é a primária completa (nada de índice parcial — a causa do 42P10 da 0226).
  assert.doesNotMatch(sql, /create unique index[^;]*where/i);
});

test("a spec de laboratório t1600 prova o caminho real: adiar, adiar de novo, retomar e retomar de novo", () => {
  const spec = ler("tests/e2e/specs/t1600-e721-adiar-conversa.spec.ts");
  for (const passo of ["1. Adiar pela primeira vez", "2. Adiar de novo", "3. Retomar", "4. Retomar de novo"]) assert.match(spec, new RegExp(passo.replace(/\./g, "\\.")));
  assert.match(spec, /conversa-adiar-erro"\)\)\.toHaveCount\(0\)/);
  assert.doesNotMatch(spec, /test\.fail\(/);
});

test("a tela: botão Adiar sempre à vista, menu de prazos, Retomar, chip Adiadas e a lista lê o estado do banco", () => {
  const t = ler("src/app/(dashboard)/dashboard/mensagens/messages-client.tsx");
  for (const id of ["conversa-adiar", "conversa-adiar-menu", "conversa-retomar", "mensagens-filtro-adiadas", "conversa-adiada-aviso"]) assert.match(t, new RegExp(`data-testid="${id}"`));
  assert.match(t, /conversa-adiar-\$\{p\.id\}/);
  assert.match(t, /separarAdiadas\(conversations\)/);
  assert.match(t, /adiarConversa\(id, prazo\)/);
  assert.match(t, /retomarConversa\(id\)/);
  assert.match(ler("src/lib/data/messages.ts"), /from\("conversas_adiadas"\)\.select\("conversation_id, adiada_em, ate"\)\.eq\("user_id", user\.id\)/);
});
