/*
  ADMIN-2 — fusões sem quebrar links.
  Roda: node --test src/lib/admin/admin2-fusoes.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { HREF_FOTOGRAFOS, contarPorTipo, doTipo, hrefParceiros, tipoDoParam } from "./parceiros-tipo.ts";
import { ABAS_AGENTES, HREF_APROVACOES, abaDaUrl } from "./agentes-abas.ts";
import { HREF_EMAILS_TESTE, abaDadosTeste } from "./dados-teste-abas.ts";
import { FILTROS_CENTRAL, hrefCentral, montarCentral, type LinhaCentral } from "./central-pendencias.ts";

const ler = (p: string) => readFileSync(p, "utf8");
const A = "src/app/(dashboard)/admin";

test("cada rota antiga redireciona para o lugar novo (sem apagar a página)", () => {
  const casos: [string, RegExp][] = [
    [`${A}/fotografos/page.tsx`, /redirect\(HREF_FOTOGRAFOS\)/],
    [`${A}/avaliacoes/page.tsx`, /redirect\(hrefCentral\("avaliacoes_contestadas"\)\)/],
    [`${A}/emails-teste/page.tsx`, /redirect\(HREF_EMAILS_TESTE\)/],
  ];
  for (const [arq, re] of casos) assert.match(ler(arq), re, arq);
  assert.equal(HREF_FOTOGRAFOS, "/admin/parceiros?tipo=fotografo");
  assert.equal(hrefCentral("avaliacoes_contestadas"), "/admin/pendencias?filtro=avaliacoes_contestadas");
  assert.equal(HREF_EMAILS_TESTE, "/admin/dados-de-teste?aba=emails");
  assert.equal(HREF_APROVACOES, "/admin/agentes?aba=aprovacoes");
});

test("Parceiros: Todos | Fotógrafos | Outros; o contador de Todos é a soma das abas, da mesma lista", () => {
  const lista = [{ categorias: ["fotografia"] }, { categorias: ["limpeza"] }, { categorias: ["fotografia", "limpeza"] }, { categorias: null }];
  const n = contarPorTipo(lista);
  assert.deepEqual(n, { todos: 4, fotografo: 2, outros: 2 });
  assert.equal(n.todos, n.fotografo + n.outros);
  assert.equal(lista.filter((l) => doTipo("fotografo", l.categorias)).length, n.fotografo);
  assert.equal(lista.filter((l) => doTipo("outros", l.categorias)).length, n.outros);
  assert.equal(tipoDoParam("fotografo"), "fotografo");
  assert.equal(tipoDoParam("x"), "todos");
  assert.equal(hrefParceiros({ aba: "ativas", tipo: "fotografo" }), "/admin/parceiros?aba=ativas&tipo=fotografo");
  assert.equal(hrefParceiros({ aba: "pendentes", tipo: "todos" }), "/admin/parceiros");
  const pagina = ler(`${A}/parceiros/page.tsx`);
  assert.match(pagina, /const porTipo = contarPorTipo\(/);
  assert.match(pagina, /data-testid=\{`admin-parceiros-tipo-\$\{t\.valor\}`\}/);
  assert.doesNotMatch(pagina, /href="\/admin\/fotografos"/);
});

test("Avaliações contestadas é filtro da Central (equipe decide) e conta como as outras filas", () => {
  const f = FILTROS_CENTRAL.find((x) => x.chave === "avaliacoes_contestadas");
  assert.deepEqual(f && { rotulo: f.rotulo, lado: f.lado }, { rotulo: "Avaliações contestadas", lado: "equipe" });
  const linha = (id: string, teste = false): LinhaCentral => ({ filtro: "avaliacoes_contestadas", id, titulo: "t", detalhe: null, desde: "2026-10-01T00:00:00Z", prazoAte: null, gravidade: "media", acao: { rotulo: "Decidir", href: "#" }, teste, ref: { revisao: id } });
  const c = montarCentral([linha("a"), linha("b"), linha("t", true)], new Date("2026-10-25T00:00:00Z"), "avaliacoes_contestadas");
  assert.equal(c.contagens.avaliacoes_contestadas, 2);
  assert.equal(c.teste.length, 1);
  assert.match(ler(`${A}/pendencias/page.tsx`), /l\.filtro === "avaliacoes_contestadas" && l\.ref\?\.revisao && <DecidirRevisaoAvaliacao id=\{l\.ref\.revisao\} \/>/);
});

test("Central de Agentes: Aprovações é aba; ?aba=aprovacoes e o antigo #aprovacoes abrem a aba", () => {
  assert.ok(ABAS_AGENTES.includes("Aprovações"));
  assert.equal(abaDaUrl("aprovacoes"), "Aprovações");
  assert.equal(abaDaUrl(null, "#aprovacoes"), "Aprovações");
  assert.equal(abaDaUrl(null, ""), "Equipe");
  const c = ler(`${A}/agentes/central-client.tsx`);
  assert.match(c, /abaDaUrl\(null, window\.location\.hash\) !== "Aprovações"/);
  assert.match(c, /aba === "Aprovações" \? \(\s*<section id="aprovacoes"/);
});

test("Dados de teste: abas Dados | E-mails", () => {
  assert.equal(abaDadosTeste("emails"), "emails");
  assert.equal(abaDadosTeste(undefined), "dados");
  assert.match(ler(`${A}/dados-de-teste/page.tsx`), /<AbasDadosTeste ativa=\{aba\} \/>/);
});
