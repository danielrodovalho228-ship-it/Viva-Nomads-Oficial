/*
  Auditoria de erros e estados vazios — achado nº 21 (três leituras que escondiam a falha do banco atrás de um "zero" ou de um
  histórico vazio):
   • Contadores da fila de Documentos (automáticos / corrija / revisão) e de Matrículas (conferidos / em revisão): com o banco
     fora, o admin lia "0 em revisão" e achava que não havia nada a conferir. Agora a página pede com `exigir`: a falha lança
     e o painel mostra "Não conseguimos abrir esta tela" com "Tentar de novo".
   • Conversas e atas da Central de Agentes: com o banco fora, a rota respondia 200 com a lista vazia e a Central mostrava
     "Nenhuma conversa ainda" (o admin podia reenviar ordens que já existem). Agora a rota responde 503 e a Central diz que não
     conseguiu carregar, com "Tentar de novo".
  Roda: node --test src/lib/data/lista-contadores-conversas-falha.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const ler = (p: string) => readFileSync(new URL(`../../../${p}`, import.meta.url), "utf8");

test("os contadores da fila de Documentos lançam na falha do banco quando a página pede com exigir", () => {
  const src = ler("src/lib/data/documentos-admin.ts");
  assert.match(src, /export async function contadoresConferencia\(opcoes: \{ exigir\?: boolean \} = \{\}\)/);
  assert.match(src, /const \{ data, error \} = await adm\s*\n\s*\.from\("qualification_checklists"\)/);
  assert.match(src, /if \(error && opcoes\.exigir\) throw new Error\(MSG_FILA_DOCUMENTOS_NAO_CARREGOU\);\n\s*const out = \{ \.\.\.zero \};/);
});

test("os contadores de Matrículas lançam na falha do banco quando a página pede com exigir", () => {
  const src = ler("src/lib/data/matriculas-admin.ts");
  assert.match(src, /export async function contadoresMatriculas\(opcoes: \{ exigir\?: boolean \} = \{\}\)/);
  assert.match(src, /const \{ data, error \} = await ctx\.admin\.from\("property_ownership_checks"\)/);
  assert.match(src, /if \(error && opcoes\.exigir\) throw new Error\(MSG_FILA_MATRICULAS_NAO_CARREGOU\);/);
});

test("a página da fila pede os dois contadores com exigir; quem não pede segue best-effort", () => {
  const pagina = ler("src/app/(dashboard)/admin/documentos/page.tsx");
  assert.match(pagina, /contadoresConferencia\(\{ exigir: true \}\)/);
  assert.match(pagina, /contadoresMatriculas\(\{ exigir: true \}\)/);
});

test("conversas e atas da Central: a leitura lança na falha e a rota responde 503 (nunca 200 com lista vazia)", () => {
  const lib = ler("src/lib/data/agentes-conversas.ts");
  assert.match(lib, /const \{ data, error \} = await q;\n\s*if \(error\) throw new Error\(MSG_CONVERSAS_NAO_CARREGARAM\);\n\s*const linhas = \(data \?\? \[\]\) as Conversa\[\];\n\s*return \{ itens: linhas\.slice\(0, POR_PAGINA_CHAT\)/);
  assert.match(lib, /const \{ data, error \} = await q;\n\s*if \(error\) throw new Error\(MSG_CONVERSAS_NAO_CARREGARAM\);\n\s*const linhas = \(data \?\? \[\]\) as Conversa\[\];\n\s*return \{ itens: linhas\.slice\(0, POR_PAGINA_ATAS\)/);
  const rota = ler("src/app/api/admin/agentes/conversas/route.ts");
  assert.match(rota, /status: 503/);
  assert.match(rota, /catch/);
});

test("a Central diz que não conseguiu carregar (com 'Tentar de novo') em vez de 'nenhuma conversa' / 'nenhuma ata'", () => {
  const c = ler("src/app/(dashboard)/admin/agentes/central-client.tsx");
  assert.match(c, /\.catch\(\(\) => vivo && setHistorico\(\{ slug, itens: \[\], temMais: false, falhou: true \}\)\)/);
  assert.match(c, /data-testid="chat-falhou"/);
  assert.match(c, /data-testid="chat-tentar-de-novo"/);
  assert.match(c, /data-testid="atas-falhou"/);
  assert.match(c, /data-testid="atas-tentar-de-novo"/);
  // a mensagem de vazio só aparece quando a leitura deu certo
  assert.match(c, /\) : thread\.length === 0 \? \(\n\s*<p className="py-6 text-center text-sm text-muted">\n\s*Nenhuma conversa com/);
});
