/*
  Auditoria de erros e estados vazios — achado nº 6: em Propostas, Visitas e Locações, uma falha do banco virava lista
  vazia ("nenhuma proposta", "nenhuma visita", "nenhuma locação") — quem tem uma proposta a responder, uma visita marcada
  ou um contrato ativo achava que não tinha nada. Agora as três telas pedem com `exigir`: a falha lança e o painel mostra
  "Não conseguimos abrir esta tela" com "Tentar de novo". Home, notificações e contadores seguem sem `exigir`.
  Roda: node --test src/lib/data/lista-propostas-visitas-locacoes-falha.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const ler = (p: string) => readFileSync(new URL(`../../../${p}`, import.meta.url), "utf8");

test("as listas lançam na falha do banco quando a tela pede com exigir", () => {
  const prop = ler("src/lib/data/propostas-actions.ts");
  assert.match(prop, /export async function listarPropostas\(opcoes: \{ exigir\?: boolean \} = \{\}\)/);
  assert.match(prop, /const \{ data, error \} = await s\.supabase\.from\("propostas"\)[^\n]*\n\s*if \(error && opcoes\.exigir\) throw new Error\(MSG_PROPOSTAS_NAO_CARREGARAM\);/);
  const vis = ler("src/lib/data/visitas-video-actions.ts");
  for (const fn of ["listVisitasDono", "listMinhasVisitas"]) assert.match(vis, new RegExp(`export async function ${fn}\\(opcoes: \\{ exigir\\?: boolean \\} = \\{\\}\\)`), fn);
  assert.equal([...vis.matchAll(/if \(error && opcoes\.exigir\) throw new Error\(MSG_VISITAS_NAO_CARREGARAM\);/g)].length, 2);
  const loc = ler("src/lib/data/contratos-actions.ts");
  assert.match(loc, /export async function getMinhasLocacoes\(opcoes: \{ exigir\?: boolean \} = \{\}\)/);
  assert.match(loc, /if \(error && opcoes\.exigir\) throw new Error\(MSG_LOCACOES_NAO_CARREGARAM\);/);
});

test("as três telas pedem com exigir; home, notificações e contadores não", () => {
  assert.match(ler("src/app/(dashboard)/dashboard/propostas/page.tsx"), /await listarPropostas\(\{ exigir: true \}\)/);
  assert.match(ler("src/app/(dashboard)/dashboard/visitas/page.tsx"), /await listVisitasDono\(\{ exigir: true \}\) : await listMinhasVisitas\(\{ exigir: true \}\)/);
  assert.match(ler("src/app/(dashboard)/dashboard/locacoes/page.tsx"), /await getMinhasLocacoes\(\{ exigir: true \}\)/);
  assert.doesNotMatch(ler("src/lib/painel/contadores-servidor.ts"), /exigir: true/);
  // Achado nº 24: a home pede com exigir, mas SEMPRE dentro de ou(...) — a falha vira aviso no topo, nunca a página de erro.
  const homeA24 = ler("src/app/(dashboard)/dashboard/page.tsx");
  assert.equal((homeA24.match(/exigir: true/g) ?? []).length, (homeA24.match(/ou\("[a-z]+", [A-Za-z]+\([^)]*\{ exigir: true \}\)/g) ?? []).length);
});
