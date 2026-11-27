/*
  E1244 (ORDENS-DUET 1213, 1219 e 1220; MAPA-E1244) — a opção "Incluir simulações" na fila de atendimento da Central.
  Só para admin (a fila já exige admin no servidor), desligada por omissão, um parâmetro no endereço (como "Incluir
  resolvidos"). Ligada: as simulações aparecem marcadas "Simulação", DEPOIS dos chamados reais (o limite de 200 nunca
  tira um real da lista por causa delas) e sem relógio de prazo. As contagens NÃO mudam: a aba "aprovação" nunca leva a
  opção (a bolinha conta essa lista), o "Nada pendente" conta a opção como filtro, e os 22 sítios das contagens não leem
  a fila. O comportamento na tela é provado pela t1803 (laboratório); aqui, o código.
  Roda: node --test src/lib/data/e1244-incluir-simulacoes.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fonteSemComentarios } from "../fonte-sem-comentarios.ts";

const ler = (p: string) => fonteSemComentarios(readFileSync(new URL(`../../${p}`, import.meta.url), "utf8"));
const acoes = ler("lib/data/atendimento-actions.ts");
const fila = acoes.slice(acoes.indexOf("export async function filaAtendimento"), acoes.indexOf("export async function chamadoAdmin"));
const pagina = ler("app/(dashboard)/admin/atendimento/page.tsx");
const cliente = ler("app/(dashboard)/admin/atendimento/atendimento-client.tsx");

test("1. a fila: sem a opção, a simulação fica fora (como hoje); a aba aprovação nunca a inclui", () => {
  assert.match(acoes, /simulacoes\?: boolean;/, "FiltrosFila ganha a opção");
  assert.match(fila, /if \(!f\.simulacoes \|\| f\.aprovacao\) q = q\.eq\("simulacao", false\);/);
  assert.doesNotMatch(fila, /\.select\(COLS_ADMIN\)\.eq\("simulacao", false\)/, "o filtro deixa de ser fixo");
});

test("2. a fila: com a opção, os chamados reais primeiro e só depois as simulações (o limite de 200 fica)", () => {
  assert.match(fila, /\.order\("simulacao", \{ ascending: true \}\)\.order\("prioridade", \{ ascending: true \}\)/);
  assert.match(fila, /\.limit\(200\)/);
});

test("3. as colunas da fila trazem a marca", () => {
  assert.match(acoes, /const COLS_ADMIN =\s*"[^"]*\bsimulacao\b[^"]*"/);
  assert.match(acoes, /simulacao\?: boolean;/);
});

test("4. a página: só a chamada da fila leva a opção; a da aprovação e o 'último resolvido' continuam sem simulação", () => {
  assert.match(pagina, /simulacoes: um\("simulacoes"\) === "1",/);
  assert.match(pagina, /filaAtendimento\(\{ aprovacao: true \}, \{ exigir: true \}\)/);
  assert.match(pagina, /\.from\("chamados"\)\.select\("resolvido_em"\)\.eq\("simulacao", false\)/);
});

test("5. a tela: a caixa 'Incluir simulações' ao lado de 'Incluir resolvidos'; a linha marcada 'Simulação' e sem relógio", () => {
  assert.match(cliente, /name="simulacoes" value="1" defaultChecked=\{filtros\.simulacoes\}/);
  assert.match(cliente, /Incluir simulações/);
  assert.match(cliente, /data-testid="chamado-simulacao"/);
  assert.match(cliente, /\{!c\.simulacao && \(/, "o relógio só nas linhas reais");
});

test("6. o 'Nada pendente' conta a opção como filtro (com simulações à vista, nunca 'nada pendente')", () => {
  assert.match(cliente, /fila\.length === 0 && !Object\.values\(filtros\)\.some\(Boolean\)/);
  assert.match(pagina, /const filtros = \{[^}]*simulacoes: um\("simulacoes"\) === "1",[^}]*\}/);
});

test("7. o detalhe do chamado leva a mesma marca", () => {
  assert.match(ler("app/(dashboard)/admin/atendimento/[id]/chamado-client.tsx"), /\{c\.simulacao && \([\s\S]{0,120}data-testid="chamado-simulacao"/);
});
