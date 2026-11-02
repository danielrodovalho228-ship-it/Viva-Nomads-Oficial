/*
  E-DOC-VIGENTE (Relay 47, decisão do Daniel de 02/11/2026: "Manter o aprovado até o novo ser aprovado"). Teste PERMANENTE
  dos 3 casos do arquivo:
  1) envio novo com documento aprovado mantém o aprovado VIGENTE (o novo fica EM ANÁLISE, à parte);
  2) recusa do novo mantém o aprovado;
  3) aprovação do novo substitui o anterior nesse momento.
  Vale na regra pura, no servidor (portões de publicar e prontidão), no banco (0285) e na tela. Não remover nem afrouxar
  sem ordem do Daniel.
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { estadoDocumentos, linhasParaLigar, statusDepoisDoEnvio, statusPorImovel, TEXTO_NOVO_EM_ANALISE, TEXTO_NOVO_RECUSADO } from "./vigente.ts";

const ler = (rel: string) => readFileSync(new URL(rel, import.meta.url), "utf8");
const aprovadoA = { id: "a", document_status: "approved", document_review_reason: null };

test("caso 1: envio novo com documento aprovado — o aprovado segue vigente e o novo fica em análise", () => {
  const novo = { id: "b", document_status: "pending", document_review_reason: null };
  const e = estadoDocumentos([novo, aprovadoA]);
  assert.equal(e.status, "approved");
  assert.equal(e.vigente?.id, "a");
  assert.equal(e.emAnalise?.id, "b");
  assert.equal(e.novoRecusado, null);
  // Salvar a qualificação de novo (linha herdando o envio em análise) não muda nada.
  assert.equal(estadoDocumentos([{ ...novo, id: "c" }, novo, aprovadoA]).status, "approved");
  assert.match(TEXTO_NOVO_EM_ANALISE, /aprovado continua valendo/);
});

test("caso 2: o novo é recusado — o aprovado segue valendo", () => {
  const recusado = { id: "b", document_status: "rejected", document_review_reason: "Ilegível" };
  const e = estadoDocumentos([recusado, aprovadoA]);
  assert.equal(e.status, "approved");
  assert.equal(e.vigente?.id, "a");
  assert.equal(e.novoRecusado?.document_review_reason, "Ilegível");
  assert.equal(e.emAnalise, null);
  assert.match(TEXTO_NOVO_RECUSADO, /aprovado continua valendo/);
});

test("caso 3: o novo é aprovado — passa a ser o vigente nesse momento", () => {
  const e = estadoDocumentos([{ id: "b", document_status: "approved", document_review_reason: null }, aprovadoA]);
  assert.equal(e.status, "approved");
  assert.equal(e.vigente?.id, "b");
  assert.equal(e.emAnalise, null);
  assert.equal(e.novoRecusado, null);
});

test("sem nenhum aprovado, vale a linha mais recente (o fluxo de sempre)", () => {
  assert.equal(estadoDocumentos([]).status, "none");
  assert.equal(estadoDocumentos([{ document_status: "pending" }]).status, "pending");
  assert.equal(estadoDocumentos([{ document_status: "rejected" }, { document_status: "pending" }]).status, "rejected");
  assert.equal(estadoDocumentos([{ document_status: "lixo" }]).status, "none");
});

test("por imóvel: cada imóvel tem o seu vigente (o de um não vale para o outro)", () => {
  const m = statusPorImovel([
    { property_id: "p1", document_status: "pending" },
    { property_id: "p2", document_status: "pending" },
    { property_id: "p1", document_status: "approved" },
    { property_id: null, document_status: "approved" },
  ]);
  assert.equal(m.get("p1"), "approved");
  assert.equal(m.get("p2"), "pending");
  assert.equal(m.size, 2);
});

test("imóvel novo: liga a qualificação mais recente E a aprovada vigente (o aprovado não fica para trás)", () => {
  const e = estadoDocumentos([{ id: "b", document_status: "pending" }, { id: "a", document_status: "approved" }]);
  assert.deepEqual(linhasParaLigar(e), ["b", "a"]);
  assert.deepEqual(linhasParaLigar(estadoDocumentos([{ id: "a", document_status: "approved" }])), ["a"]);
  assert.deepEqual(linhasParaLigar(estadoDocumentos([] as { id: string; document_status: string }[])), []);
  assert.match(ler("../data/actions.ts"), /const ligar = linhasParaLigar\(qualificacao\);[\s\S]{0,200}\.in\("id", ligar\)/);
});

test("tela do editor: com aprovado vigente, o resultado do envio novo não rebaixa o estado", () => {
  for (const s of ["pending", "rejected", "none", "approved"] as const) assert.equal(statusDepoisDoEnvio(true, s), "approved");
  assert.equal(statusDepoisDoEnvio(false, "rejected"), "rejected");
});

test("servidor: nada barra o envio novo; os portões de publicar e a prontidão leem o VIGENTE", () => {
  const src = ler("../data/actions.ts");
  assert.doesNotMatch(src, /novoDocumentoBloqueado|MSG_DOCUMENTO_JA_CONFERIDO/);
  const i = src.indexOf("async function qualificacaoDoImovel(");
  const f = src.slice(i, src.indexOf("\n}\n", i));
  assert.match(f, /return estadoDocumentos\(/);
  assert.doesNotMatch(f, /\.limit\(1\)/);
  assert.match(src, /if \(!input\.asDraft && qualificacao\.status !== "approved"\)/);
  assert.match(src, /if \(q\.status !== "approved"\)/);
  assert.match(ler("../anuncio/prontidao-servidor.ts"), /statusPorImovel\(/);
  // A decisão do admin só mexe nas linhas PENDENTES do arquivo decidido: o aprovado anterior nunca é tocado.
  const adm = ler("../data/documentos-admin.ts");
  const d = adm.indexOf(".update(montarDecisaoDocumento(");
  assert.match(adm.slice(d, d + 400), /\.eq\("document_path", alvo\.document_path as string\)\s*\n\s*\.eq\("document_status", "pending"\)/);
});

test("banco (0285): o portão de publicar e a compatibilidade usam o documento vigente", () => {
  const mig = ler("../../../supabase/migrations/0285_documento_vigente.sql");
  const apl = ler("../../../supabase/producao/aplicar-0285.sql");
  const rb = ler("../../../supabase/producao/rollback/0285_rollback.sql");
  for (const sql of [mig, apl]) {
    assert.match(sql, /create or replace function public\.documento_vigente_status\(p_property uuid, p_owner uuid\)/);
    assert.match(sql, /document_status = 'approved'/);
    assert.match(sql, /public\.documento_vigente_status\(new\.id, new\.owner_id\)/);
    assert.match(sql, /public\.documento_vigente_status\(pr\.id, pr\.owner_id\) = 'approved'/);
  }
  assert.match(apl, /^begin;/m);
  assert.match(apl, /^commit;/m);
  assert.match(apl, /'0285_documento_vigente'/);
  assert.match(rb, /drop function if exists public\.documento_vigente_status/);
});

test("tela /qualificar: o campo de envio volta; com aprovado, o novo aparece à parte", () => {
  const tela = ler("../../app/(dashboard)/qualificar/qualificar-client.tsx");
  assert.doesNotMatch(tela, /documento-conferido-mantido/);
  assert.match(tela, /data-testid="documento-novo-em-analise"/);
  assert.match(tela, /data-testid="documento-novo-recusado"/);
  assert.match(tela, /if \(docStatus === "approved"\) \{\s*setDocNovo\("pending"\)/);
});
