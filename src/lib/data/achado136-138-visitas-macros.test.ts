/*
  Varredura de erros (rodada 27): falha de leitura não vira "sem endereço" nem "nenhuma resposta pronta".
  Achado 136: lista de visitas do MORADOR — a falha ao ler o imóvel fazia sumir o endereço de uma visita já confirmada, sem
    aviso (a tela não explica a ausência). Com `exigir` (a tela da lista), lança.
  Achado 137: lista de visitas do DONO — mesma leitura do imóvel (endereço e região). Com `exigir`, lança.
  Achado 138: "Respostas prontas" do atendimento — a falha virava "nenhuma resposta pronta" e o admin recriaria macros que já
    existem. A aba pede com `exigir`; a conversa do chamado segue best-effort (o menu de macros só fica vazio).
  Roda: node --test src/lib/data/achado136-138-visitas-macros.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const ler = (p: string) => readFileSync(new URL(`../../../${p}`, import.meta.url), "utf8");
const visitas = ler("src/lib/data/visitas-video-actions.ts");

test("Achado 136: a lista do morador lança na falha ao ler o imóvel da visita confirmada", () => {
  const fn = visitas.slice(visitas.indexOf("export async function listMinhasVisitas"));
  assert.match(fn, /const \{ data: props, error: erroProps \} = await admin\.from\("properties"\)/);
  assert.match(fn, /if \(erroProps && opcoes\.exigir\) throw new Error\(MSG_VISITAS_NAO_CARREGARAM\);/);
});

test("Achado 137: a lista do dono lança na falha ao ler o imóvel das visitas", () => {
  const fn = visitas.slice(visitas.indexOf("export async function listVisitasDono"), visitas.indexOf("export async function listMinhasVisitas"));
  assert.match(fn, /const \{ data: props, error: erroProps \} = await admin\.from\("properties"\)/);
  assert.match(fn, /if \(erroProps && opcoes\.exigir\) throw new Error\(MSG_VISITAS_NAO_CARREGARAM\);/);
});

test("a tela da lista de visitas continua pedindo com exigir", () => {
  assert.match(ler("src/app/(dashboard)/dashboard/visitas/page.tsx"), /listVisitasDono\(\{ exigir: true \}\)[\s\S]*listMinhasVisitas\(\{ exigir:/);
});

test("Achado 138: listarMacros lança na falha com exigir; a aba Respostas prontas pede com exigir", () => {
  const a = ler("src/lib/data/atendimento-actions.ts");
  assert.match(a, /export async function listarMacros\(opcoes: \{ exigir\?: boolean \} = \{\}\): Promise<Macro\[\]>/);
  assert.match(a, /const \{ data, error \} = await ctx\.admin\.from\("chamado_macros"\)\.select\("id, titulo, corpo"\)\.order\("titulo"\);\s*\n\s*if \(error && opcoes\.exigir\) throw new Error\(MSG_MACROS_NAO_CARREGARAM\);/);
  assert.match(ler("src/app/(dashboard)/admin/atendimento/page.tsx"), /aba === "respostas" \? listarMacros\(\{ exigir: true \}\)/);
  // a conversa do chamado segue sem exigir (o menu de macros só fica vazio)
  assert.match(ler("src/app/(dashboard)/admin/atendimento/[id]/page.tsx"), /listarMacros\(\)/);
});
