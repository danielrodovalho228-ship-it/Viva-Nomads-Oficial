/*
  PRESERVAR O VÍNCULO/SELO ATIVO — fluxo irmão: documento do imóvel (selo "Documentação conferida"). Teste PERMANENTE:
  1) um arquivo novo NUNCA rebaixa o documento aprovado (não entra na fila: a linha nova "em análise" viraria a mais recente);
  2) recusa ou expiração de um pedido novo não existem sobre o aprovado (o pedido nem nasce) — o aprovado continua;
  3) a troca do documento conferido só com pedido explícito à equipe.
  Não remover nem afrouxar sem ordem do Daniel.
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { MSG_DOCUMENTO_JA_CONFERIDO, novoDocumentoBloqueado } from "./fila-envio.ts";

test("caso 1: com o documento aprovado, um arquivo novo é recusado", () => {
  assert.equal(novoDocumentoBloqueado("approved", "dono/a.pdf", "dono/b.pdf"), true);
  assert.match(MSG_DOCUMENTO_JA_CONFERIDO, /continua valendo/);
});

test("caso 1b: o mesmo arquivo (resposta perdida) segue liberado — não grava nada novo", () => {
  assert.equal(novoDocumentoBloqueado("approved", "dono/a.pdf", "dono/a.pdf"), false);
  assert.equal(novoDocumentoBloqueado("approved", "dono/a.pdf", null), false);
});

test("caso 2: sem documento aprovado (em análise, recusado, nenhum), o envio novo segue liberado", () => {
  for (const st of ["pending", "rejected", "none", null, undefined]) assert.equal(novoDocumentoBloqueado(st, "dono/a.pdf", "dono/b.pdf"), false, String(st));
});

test("servidor: os dois caminhos que gravam documento novo recusam antes de gravar; a tela esconde o campo", () => {
  const src = readFileSync(new URL("../data/actions.ts", import.meta.url), "utf8");
  for (const [nome, insert] of [
    ["saveQualification", "documentoNoSalvar("],
    ["enviarDocumentoParaConferencia", 'from("qualification_checklists").insert('],
  ] as const) {
    const i = src.indexOf(`export async function ${nome}(`);
    const f = src.slice(i, src.indexOf("\n}\n", i));
    const g = f.indexOf("novoDocumentoBloqueado(");
    assert.ok(g > 0, nome);
    assert.ok(g < f.indexOf(insert), `${nome}: antes de gravar`);
    assert.match(f.slice(g, g + 400), /return \{ ok: false, error: MSG_DOCUMENTO_JA_CONFERIDO \}/, nome);
  }
  const tela = readFileSync(new URL("../../app/(dashboard)/qualificar/qualificar-client.tsx", import.meta.url), "utf8");
  assert.match(tela, /docStatus === "approved" \? \(\s*<p[^>]*data-testid="documento-conferido-mantido"/);
});
