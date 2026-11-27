/*
  E582 — o envio da proposta falhava em SILÊNCIO quando faltava o CPF do proprietário: "Enviar proposta" clicado 2×,
  spinner e volta, sem erro, sem número, Orçamentos vazio (prova do QA, 04/11: proprietario2@ sem CPF). O aviso de CPF
  só existia em Interessados, longe do botão.
  Correção: o portão fala NO formulário — a montagem sabe se o documento está completo, mostra a trava ao lado do botão
  com o caminho de um clique (Conta → Documento) e, no envio, não chama o servidor: mostra a mesma mensagem com o link.
  O servidor devolve a mensagem própria da proposta. E nenhum envio falha sem mensagem: sem texto do servidor, a frase
  padrão; o aviso rola para a vista.
  Roda: node --test src/lib/propostas/e582-cpf-no-formulario.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { MSG_DOCUMENTO, LINK_DOCUMENTO } from "../documento-pessoa.ts";

const ler = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");
const form = ler("app/(dashboard)/dashboard/orcamentos/nova/montagem-proposta.tsx");
const acoes = ler("lib/data/propostas-actions.ts");

test("a mensagem da proposta fala do envio e aponta Conta → Documento", () => {
  assert.match(MSG_DOCUMENTO.proposta, /enviar a proposta/);
  assert.match(MSG_DOCUMENTO.proposta, /Conta → Documento/);
  assert.equal(LINK_DOCUMENTO, "/dashboard/conta/dados#documento");
});

test("servidor: a montagem diz se o documento está completo; o envio devolve a mensagem da proposta", () => {
  assert.match(acoes, /documentoOk: boolean;/);
  assert.match(acoes, /documentoOk: await temDocumento\(s\.admin, s\.user\.id\)/);
  const envio = acoes.slice(acoes.indexOf("export async function enviarProposta"), acoes.indexOf("export async function enviarProposta") + 1500);
  assert.match(envio, /if \(!\(await temDocumento\(s\.admin, s\.user\.id\)\)\) return \{ ok: false, error: MSG_DOCUMENTO\.proposta \};/);
});

test("formulário: a trava aparece ao lado do botão com o caminho de um clique; o envio sem documento não chama o servidor", () => {
  assert.match(form, /data-testid="proposta-trava-documento"/);
  assert.match(form, /href=\{LINK_DOCUMENTO\}/);
  const enviar = form.slice(form.indexOf("async function enviar("), form.indexOf("const diasMin"));
  assert.match(enviar, /if \(!dados\.documentoOk\) return mostrarErro\(MSG_DOCUMENTO\.proposta\);/);
  assert.ok(enviar.indexOf("dados.documentoOk") < enviar.indexOf("enviarProposta("), "a trava vem antes de chamar o servidor");
});

test("nenhum envio falha sem mensagem: sem texto do servidor, a frase padrão; o aviso rola para a vista", () => {
  assert.match(form, /if \(!r\.ok\) return mostrarErro\(r\.error \|\| MSG_ACAO_FALHOU\);/);
  assert.match(form, /scrollIntoView/);
  assert.match(form, /erro === MSG_DOCUMENTO\.proposta && \(/);
});
