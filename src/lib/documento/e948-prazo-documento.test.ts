/*
  E948 (O-68; decisão do Daniel, 15/11) — prazo público da análise do documento: até 2 dias úteis; alerta interno depois
  de 1 dia útil sem decisão. T2 (documentoAtrasado), T3 (fonte única) e T4 (e-mail documento_em_analise).
  Roda: node --test src/lib/documento/e948-prazo-documento.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { documentoAtrasado, prazoRespostaDocumento, textoRespostaAte } from "./prazo-analise.ts";
import { ALERTA_DOCUMENTO_DIAS_UTEIS, PRAZO_CANAL, TEXTO_PRAZO_DOCUMENTO } from "../../config/prazos-canais.ts";
import { MATRIZ_NOTIFICACOES } from "../../config/matriz-notificacoes.ts";
import { EVENTOS_SO_EQUIPE } from "../notifications/catalogo-emails.ts";
import { TEMPLATES } from "../notifications/eventos-email.ts";

const brt = (iso: string) => new Date(`${iso}-03:00`);
const ler = (p: string) => readFileSync(p, "utf8");

test("canal documento: 2 dias úteis, alerta em 1, e a frase pública montada do canal", () => {
  assert.deepEqual(PRAZO_CANAL.documento, { diasUteis: 2, texto: "2 dias úteis" });
  assert.equal(ALERTA_DOCUMENTO_DIAS_UTEIS, 1);
  assert.equal(TEXTO_PRAZO_DOCUMENTO, "A Viva analisa o documento do imóvel em até 2 dias úteis e avisa você por e-mail.");
  assert.equal(textoRespostaAte(brt("2026-11-19T10:00")), "resposta até 24/11/2026");
  assert.equal(prazoRespostaDocumento(brt("2026-11-19T10:00")).toISOString(), brt("2026-11-24T10:00").toISOString());
});

test("T2 documentoAtrasado: antes de 1 dia útil, depois, com decisão e no fim de semana/feriado", () => {
  const env = brt("2026-11-10T10:00"); // terça
  assert.equal(documentoAtrasado(env, null, brt("2026-11-11T09:59")), false, "antes de 1 dia útil");
  assert.equal(documentoAtrasado(env, null, brt("2026-11-11T10:00")), true, "depois");
  assert.equal(documentoAtrasado(env, brt("2026-11-10T15:00"), brt("2026-11-12T10:00")), false, "com decisão");
  const sexta = brt("2026-11-13T18:00");
  assert.equal(documentoAtrasado(sexta, null, brt("2026-11-16T17:59")), false, "sexta 18h: segunda 17h59 ainda não");
  assert.equal(documentoAtrasado(sexta, null, brt("2026-11-16T18:00")), true, "sexta 18h: só atrasa na segunda 18h");
  const quinta = brt("2026-11-19T18:00");
  assert.equal(documentoAtrasado(quinta, null, brt("2026-11-23T17:59")), false, "quinta 19/11 18h: 20/11 é feriado");
  assert.equal(documentoAtrasado(quinta, null, brt("2026-11-23T18:00")), true, "só atrasa segunda 23/11 18h");
});

/** Arquivos .ts/.tsx de src (sem testes). */
const arquivos = (d: string): string[] =>
  readdirSync(d).flatMap((n) => (statSync(join(d, n)).isDirectory() ? arquivos(join(d, n)) : /\.tsx?$/.test(n) && !/\.test\./.test(n) ? [join(d, n)] : []));

test("T3 fonte única: as superfícies do prazo importam de prazos-canais", () => {
  assert.match(ler("src/app/(public)/para-proprietarios/page.tsx"), /import \{ TEXTO_PRAZO_DOCUMENTO \} from "@\/config\/prazos-canais"[\s\S]*\{TEXTO_PRAZO_DOCUMENTO\}/);
  assert.match(ler("src/lib/atendimento/faq.ts"), /TEXTO_PRAZO_DOCUMENTO[^\n]*from "\.\.\/\.\.\/config\/prazos-canais\.ts"/);
  assert.match(ler("src/lib/notifications/eventos-email.ts"), /TEXTO_PRAZO_DOCUMENTO[^\n]*from "\.\.\/\.\.\/config\/prazos-canais\.ts"/);
  // Meus imóveis: a data sai da regra pura (que lê o canal), pela prontidão.
  assert.match(ler("src/lib/anuncio/prontidao.ts"), /from "\.\.\/documento\/prazo-analise\.ts"/);
  assert.match(ler("src/lib/documento/prazo-analise.ts"), /from "\.\.\/\.\.\/config\/prazos-canais\.ts"/);
});

test("T3 fonte única: o literal '2 dias úteis' só existe em config/prazos-canais.ts", () => {
  // Fora deste item (ver "Dúvidas" do PR): o prazo do documento do MORADOR na triagem é outro canal.
  const OUTRO_CANAL = new Set(["src/components/triagem/vinculo-morador.tsx"]);
  const achados = arquivos("src").filter((f) => f !== "src/config/prazos-canais.ts" && !OUTRO_CANAL.has(f) && ler(f).includes("2 dias úteis"));
  assert.deepEqual(achados, []);
});

test("T4 e-mail: documento_em_analise ao proprietário, com o prazo exato; documento_recebido segue só da equipe", () => {
  const t = TEMPLATES.documento_em_analise;
  assert.equal(t.subject, "Recebemos o documento do seu imóvel");
  assert.equal(t.body("Ana"), `Olá Ana, recebemos a documentação do seu imóvel. ${TEXTO_PRAZO_DOCUMENTO}`);
  assert.equal(t.body(), `Olá, recebemos a documentação do seu imóvel. ${TEXTO_PRAZO_DOCUMENTO}`);
  assert.equal(t.cta, "Ver meus anúncios");
  assert.equal(t.path, "/dashboard/imoveis");
  assert.deepEqual(MATRIZ_NOTIFICACOES.documento_em_analise.papeis, ["proprietario"]);
  assert.deepEqual(MATRIZ_NOTIFICACOES.documento_recebido.papeis, ["admin"]);
  assert.ok(EVENTOS_SO_EQUIPE.includes("documento_recebido") && !EVENTOS_SO_EQUIPE.includes("documento_em_analise"));
  // Dispara no mesmo momento do documento_recebido (envio pelo cadastro, a conferência em revisão e o caso da matrícula).
  const acoes = ler("src/lib/data/actions.ts");
  assert.equal((acoes.match(/avisarDonoDocumentoEmAnalise\(user\.id, propertyId\)/g) ?? []).length, 2);
  const conf = ler("src/app/api/documentos/conferir/route.ts");
  assert.match(conf, /if \(estadoFinal === "revisao"\) await avisarAdmins\(\);\s*\/\/[^\n]*\n\s*if \(estadoFinal === "revisao"\) await avisarDonoDocumentoEmAnalise\(user\.id, imovelId\)/);
  assert.match(ler("src/app/api/documentos/matricula/caso/route.ts"), /avisarDonoDocumentoEmAnalise\(user\.id/);
});

test("alerta interno: documento_atrasado à equipe, uma vez por documento, e o atraso na mesma linha do painel", () => {
  assert.deepEqual(MATRIZ_NOTIFICACOES.documento_atrasado.papeis, ["admin"]);
  const srv = ler("src/lib/lembretes/servidor.ts");
  assert.match(srv, /umaVez\(admin, `documento_atrasado:\$\{d\.id\}`, "documento_atrasado", null\)/);
  assert.match(srv, /avisarEquipe\(admin, "documento_atrasado", "\/admin\/documentos"/);
  assert.match(ler("src/lib/data/admin-decisoes.ts"), /detalhe: \[textoFilaDocumentos\(docs\), textoDocumentosAtrasados\(docs\.atrasados\), maisAntigo/);
});
