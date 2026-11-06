/*
  Auditoria de erros e estados vazios — achado nº 20: duas leituras que escondiam a falha do banco atrás de uma lista vazia.
   • "Meus pedidos" já lançava na falha dos pedidos (nº 8), mas as RESPOSTAS RECEBIDAS da mesma tela voltavam [] — o morador
     via os pedidos sem as respostas, como se ninguém tivesse respondido.
   • As "respostas prontas" do Atendimento (macros) voltavam [] — o admin via "nenhuma resposta pronta" e podia recriar as
     que já existem.
  Agora as duas telas pedem com `exigir`: a falha lança e o painel mostra "Não conseguimos abrir esta tela" com "Tentar de novo".
  Roda: node --test src/lib/data/lista-respostas-macros-falha.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const ler = (p: string) => readFileSync(new URL(`../../../${p}`, import.meta.url), "utf8");

test("as respostas recebidas lançam na falha do banco quando a tela pede com exigir", () => {
  const src = ler("src/lib/data/pedidos-actions.ts");
  assert.match(src, /export async function getRespostasRecebidas\(opcoes: \{ exigir\?: boolean \} = \{\}\)/);
  assert.match(src, /const \{ data, error \} = await supabase\s*\n\s*\.from\("respostas_pedido"\)/);
  assert.match(src, /if \(error && opcoes\.exigir\) throw new Error\(MSG_PEDIDOS_NAO_CARREGARAM\);\n\s*\/\/ A RLS já limita/);
  assert.match(ler("src/app/(dashboard)/dashboard/pedidos/page.tsx"), /getRespostasRecebidas\(\{ exigir: true \}\)/);
});

test("as respostas prontas do Atendimento lançam na falha do banco quando a tela pede com exigir", () => {
  const src = ler("src/lib/data/atendimento-actions.ts");
  assert.match(src, /export async function listarMacros\(opcoes: \{ exigir\?: boolean \} = \{\}\): Promise<Macro\[\]>/);
  assert.match(src, /const \{ data, error \} = await ctx\.admin\.from\("chamado_macros"\)/);
  assert.match(src, /if \(error && opcoes\.exigir\) throw new Error\("Não foi possível carregar as respostas prontas agora\."\);/);
  assert.match(ler("src/app/(dashboard)/admin/atendimento/page.tsx"), /aba === "respostas" \? listarMacros\(\{ exigir: true \}\)/);
  assert.match(ler("src/app/(dashboard)/admin/atendimento/[id]/page.tsx"), /listarMacros\(\{ exigir: true \}\)/);
});

test("quem não pede exigir segue best-effort (as outras telas e as ações não mudam)", () => {
  const src = ler("src/lib/data/atendimento-actions.ts");
  assert.doesNotMatch(src, /listarMacros\(\{ exigir: true \}\)/);
  assert.match(src, /if \(!ctx\) return \[\];\n\s*const \{ data, error \}/);
});
