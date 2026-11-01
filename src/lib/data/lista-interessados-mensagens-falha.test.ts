/*
  Auditoria de erros e estados vazios — achado nº 5: em Interessados e em Mensagens, uma falha do banco virava lista vazia
  ("nenhum interessado", "nenhuma conversa") — o dono acharia que ninguém se candidatou ou escreveu. Agora as duas telas
  pedem com `exigir`: a falha lança e o painel mostra "Não conseguimos abrir esta tela" com "Tentar de novo". A home, que
  só conta mensagens, segue sem `exigir` e com .catch.
  Roda: node --test src/lib/data/lista-interessados-mensagens-falha.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const ler = (p: string) => readFileSync(new URL(`../../../${p}`, import.meta.url), "utf8");

test("listLeads e listConversations: com exigir, a falha do banco lança", () => {
  const leads = ler("src/lib/data/leads.ts");
  assert.match(leads, /export async function listLeads\(opcoes: \{ exigir\?: boolean \} = \{\}\)/);
  assert.match(leads, /if \(error && opcoes\.exigir\) throw new Error\(MSG_INTERESSADOS_NAO_CARREGARAM\);\n\s*if \(error \|\| !data\) return \[\];/);
  const msgs = ler("src/lib/data/messages.ts");
  assert.match(msgs, /export async function listConversations\(opcoes: \{ exigir\?: boolean \} = \{\}\)/);
  assert.match(msgs, /if \(error && opcoes\.exigir\) throw new Error\(MSG_MENSAGENS_NAO_CARREGARAM\);/);
});

test("as telas Interessados e Mensagens pedem com exigir; a home não", () => {
  assert.match(ler("src/app/(dashboard)/dashboard/leads/page.tsx"), /await listLeads\(\{ exigir: true \}\)/);
  assert.match(ler("src/app/(dashboard)/dashboard/mensagens/page.tsx"), /await listConversations\(\{ exigir: true \}\)/);
  const home = ler("src/app/(dashboard)/dashboard/page.tsx");
  assert.match(home, /listConversations\(\)\.catch\(\(\) => \[\]\)/);
  assert.doesNotMatch(home, /exigir: true/);
  // Leads e Mensagens ficam sob o limite de erro do painel (com "Tentar de novo").
  assert.match(ler("src/app/(dashboard)/dashboard/error.tsx"), /Tentar de novo/);
});
