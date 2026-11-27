import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { EVENTOS_VISTORIA_COM_FATOS, corpoVistoria } from "./corpo-email.ts";
import { CONFIRMACAO_DO_ACEITE, aceitoSemDataDeVisita } from "./relogio-do-pedido.ts";
import { TEMPLATES } from "../notifications/eventos-email.ts";
import { MATRIZ_NOTIFICACOES } from "../../config/matriz-notificacoes.ts";
import { TEMA_POR_EVENTO } from "../notifications/imagens-email.ts";
import { ehAvisoDeVisitaDeAvaliacao, resolvidosNaPratica, type AvisoTela, type SituacaoDosContratos } from "../notifications/sino.ts";
import { fonteSemComentarios as semComentarios } from "../fonte-sem-comentarios.ts";

/*
  E1153 (ORDEM-DUET-651, classe A, achado da passagem ao vivo, perna 4). O dono aceitava a proposta do avaliador, os
  dados ficavam certos, mas:
   (a) o avaliador não era avisado: o aceite mandava o aviso da VISITA AGENDADA ("vistoria_agendada"), e o sino só
       mostra esse aviso enquanto o pedido tem data de visita (E1128) — no aceite ainda não há data, e o aviso saía do
       sino na hora. O e-mail também dizia "a visita está agendada", que não era verdade;
   (b) a confirmação "Proposta aceita. Combinem a data da visita." só existia na resposta da ação, que some quando a
       tela se redesenha — nenhum dos dois lados a lia.
  Passa a haver o aviso próprio do aceite ao avaliador (sino e e-mail) e a leitura de confirmação no bloco pós-aceite
  dos dois lados, de uma fonte só, enquanto a visita não tem data.
*/
const ler = (p: string) => readFileSync(p, "utf8");
const EVENTO = "vistoria_proposta_aceita" as const;
const FRASE = "Proposta aceita. Combinem a data da visita."; // roteiro aprovado (ORDEM-DUET-651)
const CASA = { imovel: { id: "i1", titulo: "Casa do Lago", bairro: "Centro", cidade: "Sacramento" } };
const PEDIDO = "22222222-2222-4222-8222-222222222222";
const AGORA = "2026-11-24T07:00:00.000Z";
const aviso = (p: Partial<AvisoTela> & { id: string; evento: string }): AvisoTela =>
  ({ prioridade: "normal", titulo: "t", url: "/dashboard/parceiro/avaliacao", ref_id: PEDIDO, lido_em: null, resolvido_em: null, criado_em: AGORA, ...p }) as AvisoTela;
const semVisitaMarcada: SituacaoDosContratos = { assinarPendente: new Set(), aditivoAberto: new Set(), avaliacaoComVisita: { pedidos: new Set(), imoveis: new Set() } };

test("E1153: a causa — o aviso da visita agendada, num pedido ainda sem data, sai do sino; o aviso do aceite fica", () => {
  // Era o que o aceite mandava: no aceite o pedido ainda não tem data de visita.
  const daVisita = aviso({ id: "v", evento: "vistoria_agendada" });
  assert.equal(resolvidosNaPratica([daVisita], semVisitaMarcada, AGORA)[0].resolvido_em, AGORA, "o E1128 dá o aviso de visita por resolvido: o avaliador não o vê");
  // O aviso próprio do aceite não é um aviso de visita: fica no sino até ser lido.
  assert.equal(ehAvisoDeVisitaDeAvaliacao(EVENTO), false);
  const doAceite = aviso({ id: "a", evento: EVENTO });
  assert.equal(resolvidosNaPratica([doAceite], semVisitaMarcada, AGORA)[0].resolvido_em, null);
});

test("E1153: o aceite avisa o avaliador pelo evento próprio, com o pedido, e leva às Visitas; já não manda 'visita agendada'", () => {
  const acoes = semComentarios(ler("src/lib/vistoria/actions.ts"));
  const aceitar = acoes.slice(acoes.indexOf("export async function aceitarProposta("), acoes.indexOf("export async function recusarProposta("));
  assert.ok(aceitar.length > 100);
  assert.match(aceitar, /await avisar\(c\.admin, [^;]*\?\.user_id, "vistoria_proposta_aceita", `\$\{ROTA_AVALIADOR\}#agenda`, \{ pedidoId: c\.p\.id, propertyId: c\.p\.property_id \}\);/);
  assert.doesNotMatch(aceitar, /"vistoria_agendada"/, "no aceite ainda não há visita agendada");
  // O aviso vem depois de gravar o aceite, e a recusa por prazo (E1142) continua antes dos dois.
  const recusa = aceitar.indexOf("return { ok: false, erro: ERRO_ACEITE_FORA_DO_PRAZO };");
  const grava = aceitar.indexOf(".update({ proposta_aceita_em:");
  const avisa = aceitar.indexOf('"vistoria_proposta_aceita"');
  assert.ok(recusa > 0 && grava > recusa && avisa > grava);
  // Um só ponto envia o aviso do aceite.
  const fontes = ["src/lib/vistoria/servidor.ts", "src/lib/vistoria/actions.ts", "src/lib/vistoria/laudo-servidor.ts", "src/lib/vistoria/ativacao-automatica-servidor.ts"].map((f) => semComentarios(ler(f)));
  assert.equal(fontes.reduce((n, f) => n + (f.match(/avisar\([^;]*"vistoria_proposta_aceita"/g) ?? []).length, 0), 1);
  // A visita agendada continua a ser avisada quando a data é marcada (as duas ações de agendar).
  assert.equal((fontes[1].match(/avisar\([^;]*"vistoria_agendada"/g) ?? []).length, 4);
});

test("E1153: o aviso do aceite — textos, régua do assunto, sem códigos internos; o botão é 'Agendar a visita'", () => {
  const t = TEMPLATES[EVENTO];
  assert.equal(t.subject, "A sua proposta de avaliação foi aceita");
  assert.equal(t.body("Abel"), "Olá Abel, o proprietário aceitou a sua proposta de avaliação. Combinem a data da visita.");
  assert.equal(t.cta, "Agendar a visita");
  assert.equal(t.path, "/dashboard/parceiro/avaliacao");
  assert.ok(EVENTOS_VISTORIA_COM_FATOS.has(EVENTO), "o e-mail leva os fatos do pedido (o imóvel)");
  const c = corpoVistoria(EVENTO, CASA);
  assert.equal(c.subject, "A sua proposta de avaliação foi aceita: Casa do Lago");
  assert.equal(c.body("Abel"), "Olá Abel, o proprietário aceitou a sua proposta de avaliação de Casa do Lago. Combinem a data da visita.");
  assert.equal(c.body(), "Olá, o proprietário aceitou a sua proposta de avaliação de Casa do Lago. Combinem a data da visita.");
  assert.deepEqual(c.linhas, corpoVistoria("vistoria_proposta_expirada", CASA).linhas, "o bloco de dados é o dos outros e-mails da avaliação");
  // Sem imóvel para nomear: o assunto do modelo e a frase inteira.
  assert.equal(corpoVistoria(EVENTO, { imovel: null }).subject, null);
  assert.equal(corpoVistoria(EVENTO, { imovel: null }).body("Abel"), t.body("Abel"));
  // Título comprido: a forma curta nomeia o imóvel.
  const comprido = corpoVistoria(EVENTO, { imovel: { titulo: "Apartamento de 2 quartos com varanda no Centro", bairro: "Centro", cidade: "Uberlândia" } }).subject!;
  assert.match(comprido, /^Proposta de avaliação aceita: Apartamento de 2/);
  for (const assunto of [c.subject!, comprido, t.subject]) {
    assert.ok(`${assunto} · Viva Nomads`.length <= 70, `"${assunto}" cabe na régua com a marca`);
    assert.doesNotMatch(assunto, /vistoria_|VIS-\d|VN-[0-9A-F]{6}|[0-9a-f]{8}-[0-9a-f]{4}-/);
  }
  // A segunda frase do aviso é a do roteiro aprovado.
  assert.ok(FRASE.endsWith("Combinem a data da visita."));
  assert.ok(c.body("Abel").endsWith("Combinem a data da visita."));
});

test("E1153: é um aviso de decisão do parceiro, sem push (como o que saía no aceite), com o tema dos transacionais", () => {
  assert.equal(MATRIZ_NOTIFICACOES[EVENTO].categoria, "decisao");
  assert.deepEqual(MATRIZ_NOTIFICACOES[EVENTO].papeis, ["parceiro"]);
  assert.deepEqual(MATRIZ_NOTIFICACOES[EVENTO].canais, MATRIZ_NOTIFICACOES.vistoria_agendada.canais);
  assert.ok(MATRIZ_NOTIFICACOES[EVENTO].canais.includes("central"), "o sino");
  assert.ok(!MATRIZ_NOTIFICACOES[EVENTO].canais.includes("push"));
  assert.equal(TEMA_POR_EVENTO[EVENTO], "transacional");
});

test("E1153: a confirmação é uma frase só, e vale enquanto o pedido está aceito pelo dono e a visita não tem data", () => {
  assert.equal(CONFIRMACAO_DO_ACEITE, FRASE);
  const aceitoEm = "2026-11-24T06:48:31.000Z";
  assert.equal(aceitoSemDataDeVisita({ status: "designado", propostaAceitaEm: aceitoEm, agendadoPara: null }), true);
  assert.equal(aceitoSemDataDeVisita({ status: "designado", propostaAceitaEm: aceitoEm, agendadoPara: undefined }), true);
  // Antes do aceite: a proposta ainda espera o dono.
  assert.equal(aceitoSemDataDeVisita({ status: "designado", propostaAceitaEm: null, agendadoPara: null }), false);
  // A avaliação de teste do credenciamento não tem aceite do dono: não há proposta aceita para confirmar.
  assert.equal(aceitoSemDataDeVisita({ status: "designado", propostaAceitaEm: undefined, agendadoPara: null }), false);
  // Marcada a data, a frase "combinem a data" deixa de valer: a tela mostra a visita.
  assert.equal(aceitoSemDataDeVisita({ status: "agendado", propostaAceitaEm: aceitoEm, agendadoPara: "2026-11-27T13:00:00.000Z" }), false);
  assert.equal(aceitoSemDataDeVisita({ status: "designado", propostaAceitaEm: aceitoEm, agendadoPara: "2026-11-27T13:00:00.000Z" }), false);
  // Fora da escolha (devolvido ao dono, realizada, laudo emitido, cancelado): nada a combinar.
  for (const status of ["pedido", "realizada", "laudo_emitido", "cancelado"]) assert.equal(aceitoSemDataDeVisita({ status, propostaAceitaEm: aceitoEm, agendadoPara: null }), false, status);
});

test("E1153: os dois lados leem a MESMA frase, da mesma fonte e pela mesma regra — a ação, o bloco do dono, a lista e a tela do pedido do avaliador", () => {
  const frases = (fonte: string) => (fonte.match(/Proposta aceita\. Combinem a data da visita\./g) ?? []).length;
  // A frase está escrita num lugar só.
  assert.equal(frases(semComentarios(ler("src/lib/vistoria/relogio-do-pedido.ts"))), 1);
  const acoes = semComentarios(ler("src/lib/vistoria/actions.ts"));
  assert.equal(frases(acoes), 0);
  assert.match(acoes.slice(acoes.indexOf("export async function aceitarProposta("), acoes.indexOf("export async function recusarProposta(")), /return \{ ok: true, mensagem: CONFIRMACAO_DO_ACEITE \};/);

  // O dono: no bloco pós-aceite, por cima do combinado.
  const bloco = semComentarios(ler("src/components/vistoria/bloco-avaliacao-dono.tsx"));
  assert.equal(frases(bloco), 0);
  // E1173 (asserção alterada, ORDEM-DUET-763, a folha): no bloco do dono a frase sai quando o morador recusou a data
  // (a frase de situação já diz o passo). A regra, a fonte e a frase continuam as mesmas.
  assert.match(bloco, /\{aceitoSemDataDeVisita\(\{ status: atual\.status, propostaAceitaEm: atual\.proposta_aceita_em, agendadoPara: atual\.agendado_para \}\) && !recusouAData && \(\s*<p [^>]*data-testid="avaliacao-aceite-confirmado"[^>]*>\s*\{CONFIRMACAO_DO_ACEITE\}\s*<\/p>/);
  assert.ok(bloco.indexOf('data-testid="avaliacao-aceite-confirmado"') < bloco.indexOf('data-testid="avaliacao-proposta-aceita"'));

  // O avaliador, na lista (as Visitas): junto do formulário de agendar, só para quem tem a proposta aceita.
  const lista = semComentarios(ler("src/app/(dashboard)/dashboard/parceiro/avaliacao/page.tsx"));
  assert.equal(frases(lista), 0);
  assert.match(lista, /\{r === "aceita" && aceitoSemDataDeVisita\(\{ status: p\.status, propostaAceitaEm: p\.proposta_aceita_em, agendadoPara: p\.agendado_para \}\) && \(\s*<p [^>]*data-testid="aceite-confirmado"[^>]*>\s*\{CONFIRMACAO_DO_ACEITE\}\s*<\/p>/);
  assert.ok(lista.indexOf('data-testid="aceite-confirmado"') < lista.indexOf('testid="agendar-visita"'));

  // O avaliador, na tela do pedido: por cima do botão "Agendar a visita".
  const pagina = semComentarios(ler("src/app/(dashboard)/dashboard/parceiro/avaliacao/[pedido]/page.tsx"));
  assert.equal(frases(pagina), 0);
  assert.match(pagina, /confirmacaoDoAceite=\{aceitoSemDataDeVisita\(\{ status: p\.status as string, propostaAceitaEm: dados\.proposta_aceita_em, agendadoPara: p\.agendado_para as string \| null \}\) \? CONFIRMACAO_DO_ACEITE : null\}/);
  const tela = semComentarios(ler("src/components/avaliadores/pedido.tsx"));
  assert.equal(frases(tela), 0);
  assert.match(tela, /\{etapa === "aceito" && confirmacaoDoAceite && \(\s*<p [^>]*data-testid="pedido-aceite-confirmado"[^>]*>\s*\{confirmacaoDoAceite\}\s*<\/p>/);
  assert.ok(tela.indexOf('data-testid="pedido-aceite-confirmado"') < tela.indexOf('data-testid="pedido-agendar"'));
});
