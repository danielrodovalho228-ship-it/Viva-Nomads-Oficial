/*
  Prompt 35A, item 1 — documento enfileirado no ENVIO do /qualificar.
  Roda: node --test src/lib/documento/fila-envio.test.ts
*/
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  CAMPOS_NAO_HERDADOS,
  caminhoDoDonoValido,
  documentoJaNaFila,
  documentoNoSalvar,
  hashValido,
  linhaDoEnvio,
} from "./fila-envio.ts";
import { documentosOrfaos, chaveOrfao, textoAvisoOrfaos } from "./orfaos.ts";

const DONO = "11111111-2222-3333-4444-555555555555";
const OUTRO = "99999999-2222-3333-4444-555555555555";
const ARQ = `${DONO}/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee.pdf`;
const ARQ2 = `${DONO}/ffffffff-bbbb-cccc-dddd-eeeeeeeeeeee.jpg`;
const HASH = "a".repeat(64);

test("o caminho tem de ser um arquivo do PRÓPRIO dono no formato do upload", () => {
  assert.equal(caminhoDoDonoValido(ARQ, DONO), true);
  assert.equal(caminhoDoDonoValido(ARQ, OUTRO), false);
  assert.equal(caminhoDoDonoValido(`${DONO}/../x.pdf`, DONO), false);
  assert.equal(caminhoDoDonoValido(`${DONO}/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee.exe`, DONO), false);
  assert.equal(caminhoDoDonoValido(null, DONO), false);
  assert.equal(hashValido(HASH), HASH);
  assert.equal(hashValido("xyz"), null);
});

test("a linha do envio herda as respostas da anterior e troca SÓ o documento (status em análise)", () => {
  const anterior = {
    id: "velha",
    created_at: "2026-10-18T10:00:00Z",
    owner_id: DONO,
    property_id: null,
    furnished: true,
    eligible: true,
    ready_to_live_score: 80,
    tag_home_office: true,
    formulario: { versao: 1 },
    document_path: `${DONO}/antigo.pdf`,
    document_status: "approved",
    document_reviewed_by: OUTRO,
    conferencia: { estado: "aprovado" },
    conferido_por: "automatico",
    decisao_avisada_em: "2026-10-18T11:00:00Z",
  };
  const agora = new Date("2026-10-19T17:02:00Z");
  const l = linhaDoEnvio(anterior, { ownerId: DONO, propertyId: null, path: ARQ, hash: HASH, agora });
  for (const k of CAMPOS_NAO_HERDADOS) {
    if (!["document_path", "document_hash_sha256", "document_uploaded_at", "document_status"].includes(k)) assert.equal(k in l, false, k);
  }
  assert.equal(l.furnished, true);
  assert.equal(l.ready_to_live_score, 80);
  assert.equal(l.tag_home_office, true);
  assert.deepEqual(l.formulario, { versao: 1 });
  assert.equal(l.document_path, ARQ);
  assert.equal(l.document_hash_sha256, HASH);
  assert.equal(l.document_uploaded_at, agora.toISOString());
  assert.equal(l.document_status, "pending");
  assert.equal(l.property_id, null);
  // Sem qualificação anterior: só o documento.
  const nova = linhaDoEnvio(null, { ownerId: DONO, propertyId: "imovel", path: ARQ, hash: null, agora });
  assert.deepEqual(Object.keys(nova).sort(), ["document_hash_sha256", "document_path", "document_status", "document_uploaded_at", "owner_id", "property_id"]);
});

test("a action é idempotente: o mesmo arquivo já na fila não cria outra linha", () => {
  assert.equal(documentoJaNaFila(ARQ, ARQ), true);
  assert.equal(documentoJaNaFila(ARQ2, ARQ), false);
  assert.equal(documentoJaNaFila(null, ARQ), false);
  assert.equal(documentoJaNaFila(ARQ, null), false);
});

test("saveQualification DEPOIS do envio não duplica a linha do documento nem o aviso (herda — 0072)", () => {
  // O envio já gravou a linha com ARQ: o salvar grava sem documento (o banco herda) e não avisa de novo.
  assert.deepEqual(documentoNoSalvar(ARQ, ARQ), { gravarPath: null, avisarAdmins: false });
  // Sem documento na tela: herda, sem aviso.
  assert.deepEqual(documentoNoSalvar(ARQ, null), { gravarPath: null, avisarAdmins: false });
  // Arquivo que NÃO está na fila (caminho antigo, ex.: a action falhou): entra em análise e avisa, como antes.
  assert.deepEqual(documentoNoSalvar(ARQ2, ARQ), { gravarPath: ARQ, avisarAdmins: true });
  assert.deepEqual(documentoNoSalvar(null, ARQ), { gravarPath: ARQ, avisarAdmins: true });
});

test("saveQualification e a action usam as regras puras (sem segundo aviso)", () => {
  const src = readFileSync(new URL("../data/actions.ts", import.meta.url), "utf8");
  const ini = src.indexOf("export async function saveQualification(");
  const fim = src.indexOf("export async function enviarDocumentoParaConferencia(");
  assert.ok(ini > 0 && fim > ini, "as duas actions existem");
  const salvar = src.slice(ini, fim);
  assert.match(salvar, /documentoNoSalvar\(/);
  assert.match(salvar, /if \(doc\.avisarAdmins\) await avisarAdminsDocumentoRecebido\(\)/);
  assert.doesNotMatch(salvar, /document_path: documentPath \?\? null/);
  const enviar = src.slice(fim, src.indexOf("export type DocumentStatus"));
  assert.match(enviar, /documentoJaNaFila\(/);
  assert.match(enviar, /linhaDoEnvio\(/);
  assert.match(enviar, /avisarAdminsDocumentoRecebido\(\)/);
});

test("/qualificar só diz \"Enviado para conferência\" depois que a action confirma", () => {
  const src = readFileSync(new URL("../../app/(dashboard)/qualificar/qualificar-client.tsx", import.meta.url), "utf8");
  const ini = src.indexOf("async function enfileirarDocumento(");
  assert.ok(ini > 0);
  const fn = src.slice(ini, src.indexOf("async function save()"));
  const falha = fn.indexOf("if (!r.ok)");
  const nome = fn.indexOf("setDocName(d.nome)");
  assert.ok(falha > 0 && nome > falha, "o nome do documento (\"Enviado\") só é marcado depois do ok");
  assert.match(fn, /setDocSemFila\(d\)/);
  assert.match(src, /Tentar de novo/);
  assert.match(src, /enfileirarDocumento\(\{ path: data\.path/);
});

test("rede de segurança: só arquivos com mais de 2 h e sem referência; aviso com dono e data de Brasília", () => {
  const agora = new Date("2026-10-19T20:00:00Z");
  const arquivos = [
    { path: ARQ, ownerId: DONO, criadoEm: "2026-10-19T17:02:00Z" }, // 3 h, sem linha → órfão
    { path: ARQ2, ownerId: DONO, criadoEm: "2026-10-19T19:30:00Z" }, // 30 min → espera
    { path: `${OUTRO}/x.pdf`, ownerId: OUTRO, criadoEm: "2026-10-19T10:00:00Z" }, // tem linha
    { path: `${OUTRO}/y.pdf`, ownerId: OUTRO, criadoEm: "2026-09-01T10:00:00Z" }, // velho demais
  ];
  const r = documentosOrfaos(arquivos, new Set([`${OUTRO}/x.pdf`]), agora);
  assert.deepEqual(r.map((a) => a.path), [ARQ]);
  assert.equal(chaveOrfao(ARQ), `documento_orfao:${ARQ}`);
  const t = textoAvisoOrfaos([{ dono: "Proprietário Um", criadoEm: "2026-10-19T17:02:00Z" }]);
  assert.match(t, /Proprietário Um: enviado em 19\/10\/2026 14:02 \(horário de Brasília\)/);
  assert.match(t, /Nada foi apagado/);
});

test("o cron não apaga arquivos do bucket", () => {
  const src = readFileSync(new URL("../data/documentos-orfaos-servidor.ts", import.meta.url), "utf8");
  assert.doesNotMatch(src, /\.remove\(/);
  assert.doesNotMatch(src, /\.delete\(/);
  const cron = readFileSync(new URL("../../app/api/cron/automacoes/route.ts", import.meta.url), "utf8");
  assert.match(cron, /avisarDocumentosOrfaos\(admin, agora, simular\)/);
});
