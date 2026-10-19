/*
  Decisão de documento: identificar e agrupar por imóvel (rota rápida dos e-mails, item 3b).
  Roda: node --test src/lib/documento/aviso-decisao.test.ts
  O "quando avisar" (fila do mesmo imóvel, idempotência, cron de 2 h) é do banco (0185) e foi provado no laboratório
  com supabase/lab/teste-0185-aviso-documento.sql; aqui ficam o conteúdo do e-mail e a ligação no código.
*/
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { botaoDecisao, emailDecisaoDocumento, linhasDoAviso, rotuloDocumento, type DecisaoParaAvisar } from "./aviso-decisao.ts";
import { montarNotificacao } from "../notifications/montar-email.ts";
import { comMarca, problemasDoAssunto } from "../notifications/assuntos.ts";

const SITE = "https://vivanomads.com.br";
const visivel = (h: string) => h.replace(/<style[\s\S]*?<\/style>/g, " ").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");

function enviar(o: Parameters<typeof emailDecisaoDocumento>[0]) {
  const e = emailDecisaoDocumento(o);
  return { e, m: montarNotificacao({ siteUrl: SITE, event: e.evento, nomeHtml: "Paulo", nomeTexto: "Paulo", subject: e.assunto, body: e.intro, ctaLabel: e.cta.label, pushUrl: e.cta.path, detailsHtml: e.detailsHtml, detailsText: e.detailsText }) };
}

test("rotuloDocumento: tipo guardado quando existe; senão, o da fila", () => {
  assert.equal(rotuloDocumento("matricula"), "Matrícula do imóvel");
  assert.equal(rotuloDocumento("qualificacao"), "Comprovante de propriedade do imóvel");
  assert.equal(rotuloDocumento("qualificacao", "IPTU"), "IPTU do imóvel");
  assert.equal(rotuloDocumento("qualificacao", "identidade"), "Documento de identidade");
  assert.equal(rotuloDocumento("qualificacao", "desconhecido"), "Comprovante de propriedade do imóvel");
});

test("caso do Daniel: 4 aprovações + 3 recusas do mesmo imóvel → 1 e-mail com 7 linhas e 'Reenviar documento'", () => {
  const decisoes: DecisaoParaAvisar[] = [1, 2, 3, 4, 5, 6, 7].map((n) => ({ origem: "qualificacao", documentoPath: `doc-${n}.pdf`, aprovado: n <= 4, motivo: n > 4 ? `Motivo ${n}` : null }));
  const linhas = linhasDoAviso(decisoes);
  assert.equal(linhas.length, 7);
  const { e, m } = enviar({ propertyId: "p1", titulo: "Studio no Centro", bairro: "Centro", linhas, prontoParaPublicar: false });
  assert.equal(e.evento, "documento_recusado");
  assert.equal(m.assunto, "Conferência dos documentos: Studio no Centro · Viva Nomads");
  assert.equal(m.botao, "Reenviar documento");
  const v = visivel(m.html);
  for (let n = 1; n <= 7; n++) assert.match(v, new RegExp(`Documento ${n} `));
  assert.equal((v.match(/Precisa de ajuste/g) ?? []).length, 3);
  assert.equal((v.match(/· Aprovado/g) ?? []).length, 4);
  for (const n of [5, 6, 7]) assert.match(v, new RegExp(`Motivo: Motivo ${n}`));
  assert.match(v, /Imóvel Studio no Centro · Centro/);
  assert.match(m.html, /href="https:\/\/vivanomads\.com\.br\/dashboard\/imoveis\/p1\/editar"/);
  assert.equal(m.imagem, "transacional.jpg"); // tema Documentos até a imagem nova chegar — nunca candidatura/pedido
});

test("2 imóveis → 2 e-mails, cada um com o seu título; assunto e corpo nunca iguais", () => {
  const linhas = linhasDoAviso([{ origem: "qualificacao", documentoPath: "a.pdf", aprovado: true, motivo: null }]);
  const a = enviar({ propertyId: "p1", titulo: "Studio no Centro", bairro: "Centro", linhas, prontoParaPublicar: true }).m;
  const b = enviar({ propertyId: "p2", titulo: "Loft na Savassi", bairro: "Savassi", linhas, prontoParaPublicar: true }).m;
  assert.notEqual(a.assunto, b.assunto);
  assert.notEqual(a.html, b.html);
  assert.match(a.assunto, /Studio no Centro/);
  assert.match(b.assunto, /Loft na Savassi/);
});

test("decisão isolada → 1 e-mail com o tipo, o imóvel, a decisão e o motivo", () => {
  const rec = enviar({ propertyId: "p1", titulo: "Studio no Centro", bairro: "Centro", linhas: linhasDoAviso([{ origem: "matricula", documentoPath: "m.pdf", aprovado: false, motivo: "Matrícula ilegível" }]), prontoParaPublicar: false }).m;
  assert.equal(rec.assunto, "Documento precisa de ajuste: Studio no Centro · Viva Nomads");
  assert.match(visivel(rec.html), /Documento Matrícula do imóvel Decisão Precisa de ajuste Motivo Matrícula ilegível/);
  const ok = enviar({ propertyId: "p1", titulo: "Studio no Centro", bairro: null, linhas: linhasDoAviso([{ origem: "qualificacao", documentoPath: "q.pdf", aprovado: true, motivo: null }]), prontoParaPublicar: true }).m;
  assert.equal(ok.assunto, "Documento aprovado: Studio no Centro · Viva Nomads");
  assert.equal(ok.botao, "Publicar meu anúncio");
  for (const m of [rec, ok]) assert.deepEqual(problemasDoAssunto(m.assunto), []);
});

test("botão: recusa → Reenviar; tudo aprovado e pronto → Publicar; aprovado com pendência → Ver o que falta", () => {
  assert.equal(botaoDecisao([{ documento: "x", aprovado: true, motivo: null }, { documento: "y", aprovado: false, motivo: "m" }], true), "Reenviar documento");
  assert.equal(botaoDecisao([{ documento: "x", aprovado: true, motivo: null }], true), "Publicar meu anúncio");
  assert.equal(botaoDecisao([{ documento: "x", aprovado: true, motivo: null }], false), "Ver o que falta");
});

test("matrícula e qualificação do MESMO arquivo contam uma vez (vale a matrícula); recusas primeiro", () => {
  const l = linhasDoAviso([
    { origem: "qualificacao", documentoPath: "m.pdf", aprovado: true, motivo: null },
    { origem: "matricula", documentoPath: "m.pdf", aprovado: true, motivo: null },
    { origem: "qualificacao", documentoPath: "q.pdf", aprovado: false, motivo: "x" },
  ]);
  assert.deepEqual(l.map((x) => [x.documento, x.aprovado]), [["Comprovante de propriedade do imóvel", false], ["Matrícula do imóvel", true]]);
});

test("título do usuário no e-mail: escapado e sem link", () => {
  const m = enviar({ propertyId: "p1", titulo: '<b>Studio</b> www.golpe.com', bairro: "Centro", linhas: linhasDoAviso([{ origem: "qualificacao", documentoPath: "a.pdf", aprovado: true, motivo: null }]), prontoParaPublicar: true }).m;
  assert.doesNotMatch(m.html, /<b>Studio<\/b>/);
  assert.doesNotMatch(visivel(m.html), /golpe\.com/);
  assert.deepEqual(problemasDoAssunto(comMarca(m.titulo)), []);
});

test("ligação: as duas filas de decisão usam o aviso agrupado (nunca notify direto) e o cron diário tem a rede de 2 h", () => {
  for (const f of ["src/lib/data/documentos-admin.ts", "src/lib/data/matriculas-admin.ts"]) {
    const s = readFileSync(f, "utf8");
    assert.match(s, /avisarDecisoesDoImovel\(/, f);
    assert.doesNotMatch(s, /documento_aprovado|documento_recusado/, f);
  }
  const srv = readFileSync("src/lib/data/aviso-decisao-documento.ts", "utf8");
  assert.match(srv, /rpc\("decisoes_documento_para_avisar"/);
  assert.match(srv, /rpc\("decisoes_documento_atrasadas"/);
  assert.match(readFileSync("src/app/api/cron/automacoes/route.ts", "utf8"), /avisarDecisoesAtrasadas\(admin, 2\)/);
  const sql = readFileSync("supabase/migrations/0185_decisao_documento_aviso.sql", "utf8");
  assert.match(sql, /pg_advisory_xact_lock/);
  assert.match(sql, /decisao_avisada_em is null or q\.decisao_avisada_em < q\.document_reviewed_at/);
  assert.match(sql, /m\.resultado = 'em_revisao' and m\.revisado_em is null/);
  const aplicar = readFileSync("supabase/producao/aplicar-0185.sql", "utf8");
  assert.match(aplicar, /^begin;/m);
  assert.match(aplicar, /commit;\s*$/);
  assert.match(aplicar, /20261019000185/);
  assert.match(readFileSync("supabase/producao/rollback/0185_rollback.sql", "utf8"), /delete from supabase_migrations\.schema_migrations where version = '20261019000185'/);
});
