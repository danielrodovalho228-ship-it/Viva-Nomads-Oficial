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
  // E1060: a página pede as duas listas (a do morador e, sem pedidos próprios, a do dono) — as duas com exigir.
  const visitas = ler("src/app/(dashboard)/dashboard/visitas/page.tsx");
  assert.match(visitas, /await listVisitasDono\(\{ exigir: true \}\)/);
  assert.match(visitas, /await listMinhasVisitas\(\{ exigir: true \}\)/);
  assert.doesNotMatch(visitas, /listVisitasDono\(\)|listMinhasVisitas\(\)/);
  assert.match(ler("src/app/(dashboard)/dashboard/locacoes/page.tsx"), /await getMinhasLocacoes\(\{ exigir: true \}\)/);
  // E1093 (ORDENS 446 e 565; asserção alterada): os contadores continuam sem derrubar o menu e os NÚMEROS seguem sem
  // exigir. Só o contexto que diz quem a conta é (tem imóvel, é parceiro) passou a pedir com exigir, e SEMPRE dentro de
  // contexto(...): a falha vira "não li" (naoLidos), nunca "não tem" nem erro da rota. Antes: nenhum `exigir: true` aqui.
  const contadoresE1093 = ler("src/lib/painel/contadores-servidor.ts");
  assert.equal((contadoresE1093.match(/exigir: true/g) ?? []).length, (contadoresE1093.match(/contexto\("(temImovel|parceiro)", \(\) => [A-Za-z]+\(\{ exigir: true \}\)/g) ?? []).length);
  assert.doesNotMatch(contadoresE1093, /(contar\w+|count\w+|getMinhasLocacoes|imoveisAtivosDoDono)\(\{ exigir: true \}\)/);
  // Achado nº 24: a home pede com exigir, mas SEMPRE dentro de ou(...) — a falha vira aviso no topo, nunca a página de erro.
  const homeA24 = ler("src/app/(dashboard)/dashboard/inicio-dados.tsx");
  assert.equal((homeA24.match(/exigir: true/g) ?? []).length, (homeA24.match(/ou\("[a-z]+", [A-Za-z]+\([^)]*\{ exigir: true \}\)/g) ?? []).length);
});
