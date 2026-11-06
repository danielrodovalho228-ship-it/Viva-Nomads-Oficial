/**
 * E348 — a ficha de aprovação mostra a PROVA (identidade, documento, quem/quando/base) e o Aprovar conta a mesma história do alerta.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { AVISO_DEMONSTRACAO, BASE_PADRAO, motivoSemAprovar, provaDaIdentidade, provaDoDocumento, registroDoItem, textoDoRegistro } from "./prova-ficha.ts";

const ler = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");
const laudo = (extra: Record<string, unknown> = {}) => ({
  caf_result: { identity: true, document: true, liveness: true, light: "green", ...extra },
  traffic_light: "green",
  valid_until: "2027-11-01T12:00:00Z",
  created_at: "2026-11-01T15:30:00Z",
});

test("laudo simulado: a tela diz DEMONSTRAÇÃO e que a Certta/CAF não está contratada — nunca um 'conferida' seco", () => {
  for (const extra of [{ demo: true }, { simulado: true }]) {
    const p = provaDaIdentidade(laudo(extra), "Maria Souza");
    assert.equal(p.modo, "demonstracao");
    assert.match(p.titulo, /DEMONSTRAÇÃO/);
    assert.equal(p.aviso, AVISO_DEMONSTRACAO);
    assert.match(p.aviso ?? "", /\(Certta\/CAF\) ainda não está contratado/);
  }
  assert.equal(provaDaIdentidade(laudo(), "Maria Souza", true).modo, "demonstracao", "conta de teste também");
});

test("laudo real: resultado, data, protocolo e nome devolvido × nome do cadastro", () => {
  const p = provaDaIdentidade(laudo({ protocolo: "CAF-123", nomeRetornado: "MARIA SOUZA" }), "Maria Souza");
  assert.equal(p.modo, "real");
  assert.equal(p.aviso, null);
  const v = (r: string) => p.linhas.find((l) => l.rotulo === r)?.valor ?? "";
  assert.match(v("Resultado"), /identidade sim · documento sim · prova de vida sim/);
  assert.match(v("Data do laudo"), /01\/11\/2026/);
  assert.equal(v("Protocolo"), "CAF-123");
  assert.match(v("Nome devolvido pelo serviço"), /MARIA SOUZA \(confere com o cadastro\)/);
  const dif = provaDaIdentidade(laudo({ nomeRetornado: "JOSE LIMA" }), "Maria Souza");
  assert.match(dif.linhas.find((l) => l.rotulo === "Nome devolvido pelo serviço")?.valor ?? "", /DIFERE do cadastro/);
});

test("o que não foi registrado diz 'não registrado' (nada inventado); sem laudo, o aviso pede a conferência manual", () => {
  const p = provaDaIdentidade(laudo(), "Maria Souza");
  assert.equal(p.linhas.find((l) => l.rotulo === "Protocolo")?.valor, "não registrado");
  assert.match(p.linhas.find((l) => l.rotulo === "Nome devolvido pelo serviço")?.valor ?? "", /^não registrado/);
  const s = provaDaIdentidade(null, "Maria Souza");
  assert.equal(s.modo, "sem_laudo");
  assert.match(s.aviso ?? "", /conferência manual/);
});

test("documento: situação e data da consulta; sem consulta, diz que ainda não foi consultada", () => {
  const ok = provaDoDocumento({ documento: true, documento_conferido_em: "2026-11-02T14:00:00Z" }, "Ana");
  assert.match(ok.situacao, /conferida na Receita/);
  assert.match(ok.consultadoEm ?? "", /02\/11\/2026/);
  assert.match(provaDoDocumento({}, null).situacao, /Ainda não consultada/);
});

test("registro de cada item: quem, quando e com base em quê", () => {
  const c = { registro: { documento: { por: "u1", por_nome: "Ana Admin", em: "2026-11-02T14:00:00Z", base: "Consulta pública da Receita" } } };
  const t = textoDoRegistro(registroDoItem(c, "documento"));
  assert.match(t ?? "", /Conferido por Ana Admin em 02\/11\/2026/);
  assert.match(t ?? "", /com base em: Consulta pública da Receita/);
  assert.equal(registroDoItem(c, "area"), null);
  assert.ok(Object.keys(BASE_PADRAO).includes("identidade_manual"));
});

test("alerta × ação: cadastro incompleto trava o Aprovar e diz por quê", () => {
  assert.match(motivoSemAprovar("incompleto", true) ?? "", /cadastro está incompleto/);
  assert.match(motivoSemAprovar("checklist", false) ?? "", /checklist completo/);
  assert.equal(motivoSemAprovar("pronto", true), null);
  const f = ler("app/(dashboard)/admin/parceiros/fichas.tsx");
  assert.match(f, /disabled=\{pendente \|\| !completo \|\| estado\.tipo === "incompleto"\}/);
  assert.match(f, /data-testid="ficha-sem-aprovar"/);
});

test("a ficha mostra a prova, a declaração do parceiro e o 'com base em' de cada item", () => {
  const f = ler("app/(dashboard)/admin/parceiros/fichas.tsx");
  for (const id of ["ficha-identidade-prova", "ficha-identidade-aviso", "ficha-declaracao-titulo", "ficha-documento-prova"]) assert.match(f, new RegExp(id));
  assert.match(f, /<BaseDoItem chave=\{i\.chave\}/);
  assert.match(f, /salvarChecklistParceria\(f\.id, \{ \[chave\]: valor \}, valor \? \{ \[chave\]: bases\[chave\] \?\? "" \} : undefined\)/);
});

test("a ação grava quem/quando/base no jsonb do checklist (sem coluna nova) e apaga ao desmarcar", () => {
  const a = ler("lib/parceiros/admin-actions.ts");
  assert.match(a, /registro\[chave\] = \{/);
  assert.match(a, /por_nome:/);
  assert.match(a, /delete registro\[chave\]/);
  assert.match(a, /Diga com base em quê você conferiu este item/);
  assert.doesNotMatch(a, /alter table|migrat/i);
});
