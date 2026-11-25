import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { corpoVistoria, EVENTOS_VISTORIA_COM_FATOS } from "./corpo-email.ts";
import { TEMPLATES } from "../notifications/eventos-email.ts";
import { MATRIZ_NOTIFICACOES } from "../../config/matriz-notificacoes.ts";
import { TEMA_POR_EVENTO } from "../notifications/imagens-email.ts";
import { comMarca, problemasDoAssunto } from "../notifications/assuntos.ts";
import { REGRA_DO_REAGENDAMENTO } from "./regras.ts";
import { SEM_OUTRO_AVALIADOR, TEXTO_DA_ESPERA } from "./espera-de-avaliador.ts";
import { relogioDoPedido, textoDoPrazoDeAceiteParaODono } from "./relogio-do-pedido.ts";
import { fonteSemComentarios as semComentarios } from "../fonte-sem-comentarios.ts";

/*
  E1160 (ORDENS-DUET 659, 674 e 675; linha Parceiros). Seis sub-pontos dos e-mails da avaliação de imóvel — cada e-mail
  diz o que de facto aconteceu e o passo de quem o lê:
  (1) o aviso ao dono deixa de ser um texto para três situações: três eventos (a proposta chegou; o avaliador recusou;
      o avaliador não respondeu no prazo);
  (2) a verificação diz o passo do dono (escolher o avaliador), e não "um avaliador vai combinar a visita";
  (3) o laudo é "emitido e assinado pelo avaliador credenciado nº X; a Viva guarda o registro", e não "emitido pela Viva";
  (4) a expiração segue o estado real do pedido (há avaliador para escolher, ou a Viva avisa quando houver);
  (5) o lembrete da véspera perde o convite a mudar; dono e avaliador leem a regra da fonte; o morador lê um corpo próprio;
  (6) o reagendamento diz "nova data" (e a anterior, quando ainda se conhece no momento do envio).
  Roda: node --test src/lib/vistoria/e1160-emails-da-avaliacao.test.ts
*/
const ler = (p: string) => readFileSync(p, "utf8");
const IMOVEL = { titulo: "Apto Santa Mônica", bairro: "Santa Mônica", cidade: "Uberlândia" };
// 05/11/2026 10:00 e 06/11/2026 14:30 em Brasília.
const VISITA = "2026-11-05T13:00:00Z";
const NOVA = "2026-11-06T17:30:00Z";
const PROPOSTA = "2026-11-24T06:46:00.000Z";
// E1177 (asserção alterada, ORDEM-DUET-778): sem avaliador para escolher, o e-mail já não promete o aviso — diz que
// não há outro e que a equipe foi avisada (o avaliador que saiu fica fora do pedido; a regra não garante outro).
const SEM_OUTRO = SEM_OUTRO_AVALIADOR;
const NOVOS = ["vistoria_recusada_dono", "vistoria_sem_resposta_dono"] as const;

test("E1160 (1): a proposta chegou — o dono lê que há proposta e até quando aceita; nada de 'recusou ou não respondeu'", () => {
  const c = corpoVistoria("vistoria_designado_dono", { imovel: IMOVEL, avaliador: "Rui Avalia", propostaEm: PROPOSTA });
  assert.equal(c.subject, "Proposta de avaliação recebida: Apto Santa Mônica");
  // O prazo é a frase da fonte (E1154): a mesma que o dono lê no bloco da avaliação.
  const relogio = relogioDoPedido({ status: "designado", resposta: undefined, designadoEm: null, propostaEm: PROPOSTA, propostaAceitaEm: null, precisaDoAceite: true }, new Date(PROPOSTA));
  const prazo = textoDoPrazoDeAceiteParaODono(relogio);
  assert.equal(prazo, "Aceite em até 72 horas depois da proposta, até 27/11/2026 03:46 (horário de Brasília); passado o prazo, você escolhe outro avaliador.");
  assert.equal(c.body("Lara"), `Olá Lara, Rui Avalia, avaliador credenciado que você escolheu, enviou a proposta de valor e prazo para a avaliação de Apto Santa Mônica. ${prazo}`);
  assert.doesNotMatch(c.body("Lara"), /recusou|não respondeu/);
  assert.deepEqual(c.linhas.at(-1), { rotulo: "Avaliador", valor: "Rui Avalia" });
  // Sem os fatos (o modelo da matriz): a mesma frase, sem a data.
  assert.equal(TEMPLATES.vistoria_designado_dono.body("Lara"), "Olá Lara, o avaliador credenciado que você escolheu enviou a proposta de valor e prazo para a avaliação do seu imóvel. Aceite em até 72 horas depois da proposta; passado o prazo, você escolhe outro avaliador.");
  assert.equal(TEMPLATES.vistoria_designado_dono.subject, "Proposta de avaliação recebida");
});

test("E1160 (1): o avaliador recusou / não respondeu — cada um com o seu texto, sem mandar aceitar proposta nenhuma", () => {
  const recusou = corpoVistoria("vistoria_recusada_dono", { imovel: IMOVEL });
  assert.equal(recusou.subject, "O avaliador recusou a avaliação de Apto Santa Mônica");
  assert.equal(recusou.body("Lara"), "Olá Lara, o avaliador credenciado que você escolheu recusou o pedido de avaliação de Apto Santa Mônica. Escolha outro avaliador na página da avaliação.");
  const calou = corpoVistoria("vistoria_sem_resposta_dono", { imovel: IMOVEL });
  assert.equal(calou.subject, "O avaliador não respondeu no prazo: Apto Santa Mônica");
  assert.equal(calou.body("Lara"), "Olá Lara, o avaliador credenciado que você escolheu não respondeu no prazo ao pedido de avaliação de Apto Santa Mônica. Escolha outro avaliador na página da avaliação.");
  for (const c of [recusou, calou]) {
    assert.doesNotMatch(c.body("Lara"), /aceitar|72 horas|proposta/i, "não há proposta para aceitar");
    assert.equal(c.cta ?? null, null, "vale o botão do modelo");
  }
  // Sem outro avaliador na cidade, "escolha outro" seria falso: o corpo segue o estado real (o mesmo do sub-ponto 4).
  for (const ev of NOVOS) {
    const c = corpoVistoria(ev, { imovel: IMOVEL, aguardandoAvaliador: true });
    assert.ok(c.body("Lara").endsWith(SEM_OUTRO), ev);
    assert.doesNotMatch(c.body("Lara"), /Escolha outro/, ev);
    assert.equal(c.cta, "Ver a avaliação", ev);
  }
});

test("E1160 (1): os dois eventos novos existem em todo o lado onde um evento da avaliação tem de existir", () => {
  for (const ev of NOVOS) {
    assert.ok(EVENTOS_VISTORIA_COM_FATOS.has(ev), ev);
    assert.equal(MATRIZ_NOTIFICACOES[ev].categoria, "decisao", ev);
    assert.deepEqual(MATRIZ_NOTIFICACOES[ev].papeis, ["proprietario"], ev);
    assert.ok(!MATRIZ_NOTIFICACOES[ev].canais.includes("push"), ev);
    assert.equal(TEMA_POR_EVENTO[ev], "transacional", ev);
    assert.equal(TEMPLATES[ev].cta, "Escolher avaliador", ev);
    assert.equal(TEMPLATES[ev].path, "/dashboard/imoveis", ev);
    assert.deepEqual(problemasDoAssunto(comMarca(TEMPLATES[ev].subject)), [], ev);
    // O modelo é o próprio corpo, sem os fatos (E1158, 21).
    assert.equal(TEMPLATES[ev].body("Lara"), corpoVistoria(ev, { imovel: null }).body("Lara"), ev);
  }
  assert.equal(TEMPLATES.vistoria_recusada_dono.subject, "O avaliador recusou o pedido de avaliação");
  assert.equal(TEMPLATES.vistoria_sem_resposta_dono.subject, "O avaliador não respondeu no prazo");
});

test("E1160 (1): cada momento dispara o SEU evento — a recusa, a proposta e o silêncio", () => {
  const acoes = semComentarios(ler("src/lib/vistoria/actions.ts"));
  const recusa = acoes.slice(acoes.indexOf("export async function responderDesignacao("), acoes.indexOf("export async function", acoes.indexOf("export async function responderDesignacao(") + 10));
  assert.match(recusa, /avisar\(c\.admin, c\.p\.owner_id, "vistoria_recusada_dono", rotaDono\(c\.p\.property_id\), \{ pedidoId: c\.p\.id, propertyId: c\.p\.property_id \}\)/);
  assert.doesNotMatch(recusa, /"vistoria_designado_dono"/);
  const envios = (fonte: string, ev: string) => (fonte.match(new RegExp(`avisar\\([^;]*"${ev}"`, "g")) ?? []).length;
  const srv = semComentarios(ler("src/lib/vistoria/servidor.ts"));
  const silencio = srv.slice(srv.indexOf("const { data: abertas }"), srv.indexOf("const { data: propostas }"));
  assert.match(silencio, /avisar\(admin, p\.owner_id, "vistoria_sem_resposta_dono", rotaDono\(p\.property_id\), \{ pedidoId: d\.pedido_id, propertyId: p\.property_id \}\)/);
  // Um só ponto envia cada um; o da proposta fica só onde a proposta é gravada.
  assert.equal(envios(acoes, "vistoria_recusada_dono") + envios(srv, "vistoria_recusada_dono"), 1);
  assert.equal(envios(acoes, "vistoria_sem_resposta_dono") + envios(srv, "vistoria_sem_resposta_dono"), 1);
  assert.equal(envios(acoes, "vistoria_designado_dono"), 1);
  assert.equal(envios(srv, "vistoria_designado_dono"), 0);
  const proposta = acoes.slice(acoes.indexOf("proposta_em: agora"));
  assert.ok(proposta.indexOf('"vistoria_designado_dono"') > 0 && proposta.indexOf('"vistoria_designado_dono"') < 400, "sai logo depois de gravar a proposta");
});

test("E1160 (2): a verificação diz o passo do dono — escolher o avaliador; sem avaliador, a Viva avisa", () => {
  const c = corpoVistoria("vistoria_verificacao", { imovel: IMOVEL });
  assert.equal(c.body("Lara"), "Olá Lara, a Viva abriu uma verificação do estado de Apto Santa Mônica, com o motivo descrito na página da avaliação. O próximo passo é seu: escolha o avaliador credenciado na página da avaliação.");
  assert.doesNotMatch(c.body("Lara"), /vai combinar a visita/);
  const sem = corpoVistoria("vistoria_verificacao", { imovel: IMOVEL, aguardandoAvaliador: true });
  assert.equal(sem.body("Lara"), `Olá Lara, a Viva abriu uma verificação do estado de Apto Santa Mônica, com o motivo descrito na página da avaliação. ${TEXTO_DA_ESPERA.varios}`);
  // O aviso passa a levar o pedido: sem ele o corpo não sabe se há avaliador para escolher.
  const laudoAcoes = semComentarios(ler("src/lib/vistoria/laudo-actions.ts"));
  assert.match(laudoAcoes, /avisar\(a\.admin, im\.owner_id as string, "vistoria_verificacao", rotaDono\(im\.id as string\), \{ pedidoId: p\.id as string, propertyId: im\.id as string \}\)/);
  // E a escolha é aberta ANTES do aviso: é ela que grava se o pedido ficou a aguardar avaliador.
  assert.ok(laudoAcoes.indexOf("await abrirEscolha(a.admin, p.id as string, agora);") < laudoAcoes.indexOf('"vistoria_verificacao"'));
});

test("E1160 (3): o laudo é emitido e assinado pelo avaliador credenciado, com o número; a Viva guarda o registro", () => {
  const c = corpoVistoria("vistoria_laudo_emitido", { imovel: IMOVEL, avaliador: "Rui Avalia", numeroCredenciado: "AV-0007" });
  // E1188 (asserção alterada, ORDEM-DUET-852): saiu a frase vaga "Veja o resultado, o que corrigir (se houver), o prazo e
  // o próximo passo." — com o laudo lido, o e-mail diz os fatos dele (trava: e1188-emails-com-os-fatos-da-tela.test.ts).
  assert.equal(c.body("Lara"), "Olá Lara, o laudo de avaliação de Apto Santa Mônica foi emitido e assinado pelo avaliador credenciado nº AV-0007; a Viva guarda o registro.");
  assert.doesNotMatch(c.body("Lara"), /emitido pela Viva/);
  // Sem o número (leitura que falhou), a frase continua inteira e continua a não dizer que foi a Viva.
  const sem = corpoVistoria("vistoria_laudo_emitido", { imovel: IMOVEL });
  assert.equal(sem.body("Lara"), "Olá Lara, o laudo de avaliação de Apto Santa Mônica foi emitido e assinado pelo avaliador credenciado; a Viva guarda o registro.");
  assert.doesNotMatch(TEMPLATES.vistoria_laudo_emitido.body("Lara"), /emitido pela Viva/);
  const laudoSrv = semComentarios(ler("src/lib/vistoria/laudo-servidor.ts"));
  assert.match(laudoSrv, /avisar\(admin, p\.owner_id, "vistoria_laudo_emitido", rotaDono\(p\.property_id\), \{ pedidoId: p\.id, propertyId: p\.property_id \}\)/);
});

test("E1160 (4): a expiração segue o estado real — há quem escolher, ou a Viva avisa quando houver", () => {
  const dono = corpoVistoria("vistoria_proposta_expirada_dono", { imovel: IMOVEL });
  assert.equal(dono.body("Lara"), "Olá Lara, o prazo de 72 horas para aceitar a proposta de avaliação de Apto Santa Mônica terminou, e ela expirou. O pedido voltou para você escolher de novo.");
  assert.equal(dono.cta ?? null, null);
  const donoSem = corpoVistoria("vistoria_proposta_expirada_dono", { imovel: IMOVEL, aguardandoAvaliador: true });
  assert.equal(donoSem.body("Lara"), `Olá Lara, o prazo de 72 horas para aceitar a proposta de avaliação de Apto Santa Mônica terminou, e ela expirou. ${SEM_OUTRO}`);
  assert.doesNotMatch(donoSem.body("Lara"), /escolher de novo/);
  // O botão do modelo é "Escolher avaliador": sem ninguém para escolher, o botão não o promete.
  assert.equal(donoSem.cta, "Ver a avaliação");
  const aval = corpoVistoria("vistoria_proposta_expirada", { imovel: IMOVEL });
  assert.match(aval.body("Rui"), /e ela expirou\. O pedido voltou para ele escolher de novo\. Você não precisa fazer nada\.$/);
  const avalSem = corpoVistoria("vistoria_proposta_expirada", { imovel: IMOVEL, aguardandoAvaliador: true });
  assert.match(avalSem.body("Rui"), /e ela expirou\. O pedido voltou ao proprietário\. Você não precisa fazer nada\.$/);
  assert.doesNotMatch(avalSem.body("Rui"), /escolher de novo/);
  // Os dois avisos saem DEPOIS de o pedido voltar ao dono: é aí que o estado é gravado.
  const srv = semComentarios(ler("src/lib/vistoria/servidor.ts"));
  const ramo = srv.slice(srv.indexOf("const { data: propostas }"), srv.indexOf("const { data: parados }"));
  assert.ok(ramo.indexOf('devolverAoDono(admin, q.id, q.avaliador_id, "expirada", agora)') < ramo.indexOf('"vistoria_proposta_expirada_dono"'));
});

test("E1160 (5): o lembrete não convida a mudar; dono e avaliador leem a regra da fonte; o morador lê um corpo próprio", () => {
  const base = "Olá Lara, a visita de avaliação de Apto Santa Mônica é amanhã, 05/11/2026 às 10:00 (horário de Brasília).";
  for (const destinatario of ["dono", "avaliador"] as const) {
    const c = corpoVistoria("vistoria_lembrete", { imovel: IMOVEL, visita: VISITA, destinatario });
    assert.equal(c.body("Lara"), `${base} ${REGRA_DO_REAGENDAMENTO}`, destinatario);
  }
  const morador = corpoVistoria("vistoria_lembrete", { imovel: IMOVEL, visita: VISITA, destinatario: "morador" });
  assert.equal(morador.body("Ana"), "Olá Ana, a visita de avaliação de Apto Santa Mônica, imóvel onde você mora, é amanhã, 05/11/2026 às 10:00 (horário de Brasília). O avaliador não fotografa os seus pertences.");
  assert.doesNotMatch(morador.body("Ana"), /Reagendar/);
  // Sem saber quem lê (o modelo), a regra não entra: ela só vale para o dono e para o avaliador.
  assert.equal(corpoVistoria("vistoria_lembrete", { imovel: IMOVEL, visita: VISITA }).body("Lara"), base);
  for (const destinatario of [undefined, "dono", "avaliador", "morador"] as const) {
    assert.doesNotMatch(corpoVistoria("vistoria_lembrete", { imovel: IMOVEL, visita: VISITA, destinatario }).body("Lara"), /Se precisar mudar|avise pelas mensagens/, String(destinatario));
  }
  assert.doesNotMatch(TEMPLATES.vistoria_lembrete.body("Lara"), /Se precisar mudar|Reagendar/);
  // A rotina diz ao corpo quem lê cada um dos três.
  const srv = semComentarios(ler("src/lib/vistoria/servidor.ts"));
  assert.match(srv, /avisar\(admin, v\.owner_id, "vistoria_lembrete", rotaDono\(v\.property_id\), \{ pedidoId: v\.id, propertyId: v\.property_id, papel: "dono" \}\)/);
  assert.match(srv, /"vistoria_lembrete", ROTA_AVALIADOR, \{ pedidoId: v\.id, propertyId: v\.property_id, papel: "avaliador" \}\)/);
  assert.match(srv, /avisar\(admin, v\.morador_id, "vistoria_lembrete", rotaMorador\(v\.id\), \{ pedidoId: v\.id, propertyId: v\.property_id, papel: "morador" \}\)/);
});

test("E1160 (5): a regra do reagendamento não está escrita à mão nos e-mails — vem de REGRA_DO_REAGENDAMENTO", () => {
  const corpo = semComentarios(ler("src/lib/vistoria/corpo-email.ts"));
  assert.doesNotMatch(corpo, /Reagendar sem custo/);
  assert.doesNotMatch(corpo, /REGRAS_AGENDA/);
  assert.match(corpo, /import \{ REGRA_DO_REAGENDAMENTO \} from "\.\/regras\.ts";/);
  assert.ok(corpoVistoria("vistoria_agendada", { imovel: IMOVEL, visita: VISITA }).body("Lara").endsWith(` ${REGRA_DO_REAGENDAMENTO}`));
});

test("E1160 (6): o reagendamento diz 'nova data' no assunto, no corpo e no bloco — e a anterior, quando se conhece", () => {
  const c = corpoVistoria("vistoria_agendada", { imovel: IMOVEL, visita: NOVA, reagendada: true, visitaAnterior: VISITA });
  assert.equal(c.subject, "Nova data da visita: Apto Santa Mônica, 06/11 às 14:30");
  assert.equal(c.body("Lara"), `Olá Lara, a visita de avaliação de Apto Santa Mônica tem nova data: 06/11/2026 às 14:30; antes: 05/11/2026 às 10:00 (horário de Brasília). ${REGRA_DO_REAGENDAMENTO}`);
  assert.deepEqual(c.linhas, [
    { rotulo: "Imóvel", valor: "Apto Santa Mônica · Santa Mônica, Uberlândia" },
    { rotulo: "Nova data", valor: "06/11/2026 às 14:30 (horário de Brasília)" },
    { rotulo: "Data anterior", valor: "05/11/2026 às 10:00 (horário de Brasília)" },
  ]);
  // Imóvel ocupado (ORDEM-DUET-675): depois da concordância do morador a data anterior já não existe — só "nova data".
  const so = corpoVistoria("vistoria_agendada", { imovel: IMOVEL, visita: NOVA, reagendada: true });
  assert.equal(so.body("Lara"), `Olá Lara, a visita de avaliação de Apto Santa Mônica tem nova data: 06/11/2026 às 14:30 (horário de Brasília). ${REGRA_DO_REAGENDAMENTO}`);
  assert.deepEqual(so.linhas.at(-1), { rotulo: "Nova data", valor: "06/11/2026 às 14:30 (horário de Brasília)" });
  // A primeira marcação não muda.
  const primeira = corpoVistoria("vistoria_agendada", { imovel: IMOVEL, visita: VISITA });
  assert.equal(primeira.subject, "Visita de avaliação: Apto Santa Mônica, 05/11 às 10:00");
  assert.doesNotMatch(primeira.body("Lara"), /nova data/);
  // Sem o nome do imóvel, o assunto do modelo ("Visita de avaliação agendada") esconderia a troca: o corpo dá o seu.
  const semNome = corpoVistoria("vistoria_agendada", { imovel: null, visita: NOVA, reagendada: true });
  assert.equal(semNome.subject, "Nova data da visita de avaliação: 06/11 às 14:30");
  // A régua dos assuntos vale também para os novos, com um título comprido.
  const longo = { titulo: "apartamento enorme com vista para o mar e varanda gourmet 1201", bairro: "Centro", cidade: "Uberlândia" };
  for (const ev of ["vistoria_agendada", "vistoria_concordancia"] as const) {
    for (const imovel of [IMOVEL, longo, null]) {
      const s = corpoVistoria(ev, { imovel, visita: NOVA, reagendada: true, visitaAnterior: VISITA }).subject;
      assert.ok(s, ev);
      assert.deepEqual(problemasDoAssunto(comMarca(s!)), [], `${ev}: "${s}"`);
    }
  }
});

test("E1160 (6): o morador também lê 'nova data' quando lhe pedem a concordância de um reagendamento", () => {
  const c = corpoVistoria("vistoria_concordancia", { imovel: IMOVEL, visita: NOVA, reagendada: true, visitaAnterior: VISITA });
  assert.equal(c.subject, "Concorda com a nova data da visita: 06/11 às 14:30?");
  assert.equal(c.body("Ana"), "Olá Ana, o proprietário pediu a avaliação de Apto Santa Mônica, imóvel onde você mora, e a visita tem nova data proposta: 06/11/2026 às 14:30; antes: 05/11/2026 às 10:00 (horário de Brasília). A visita só acontece se você concordar com a data. O avaliador não fotografa os seus pertences.");
  assert.deepEqual(c.linhas.slice(-2), [
    { rotulo: "Nova data proposta", valor: "06/11/2026 às 14:30 (horário de Brasília)" },
    { rotulo: "Data anterior", valor: "05/11/2026 às 10:00 (horário de Brasília)" },
  ]);
  // A primeira proposta de data não muda.
  const primeira = corpoVistoria("vistoria_concordancia", { imovel: IMOVEL, visita: VISITA });
  assert.equal(primeira.subject, "Concorda com a visita de avaliação em 05/11 às 10:00?");
  assert.doesNotMatch(primeira.body("Ana"), /nova data/);
});

test("E1160 (6): quem agenda diz ao e-mail se é reagendamento e qual era a data; na concordância vale o registo do pedido", () => {
  const acoes = semComentarios(ler("src/lib/vistoria/actions.ts"));
  const inicio = acoes.indexOf("export async function agendarVisita(");
  const agendar = acoes.slice(inicio, acoes.indexOf("export async function concordarVisita("));
  // A data anterior é lida ANTES da gravação que a substitui, e segue na referência dos três avisos.
  // E1173 (asserção alterada, ORDEM-DUET-763, a folha): a data proposta depois de o morador recusar também é "nova
  // data" no e-mail dele. A data anterior continua a seguir só quando há reagendamento.
  assert.match(agendar, /const troca = \{ reagendada: reagendando \|\| depoisDaRecusa, visitaAnterior: reagendando \? p\.agendado_para : null \};/);
  assert.ok(agendar.indexOf("const troca = ") < agendar.indexOf("agendado_para: quando.toISOString()"));
  assert.equal((agendar.match(/\{ pedidoId: p\.id, propertyId: p\.property_id, \.\.\.troca \}/g) ?? []).length, 3);
  // Em concordarVisita a data anterior já não existe (ORDEM-DUET-675: sem coluna nova): a referência não a leva.
  const concordar = acoes.slice(acoes.indexOf("export async function concordarVisita("), acoes.indexOf("export async function", acoes.indexOf("export async function concordarVisita(") + 10));
  assert.doesNotMatch(concordar, /visitaAnterior|reagendada/);
  // Aí o "nova data" vem das marcas de reagendamento do próprio pedido, lidas com os outros fatos.
  const srv = semComentarios(ler("src/lib/vistoria/servidor.ts"));
  const fatos = srv.slice(srv.indexOf("export async function fatosDaVistoria("), srv.indexOf("export async function avisar("));
  // E1177 (asserção alterada, ORDEM-DUET-778): o select leva também o motivo da espera.
  // E1188 (asserção alterada, ORDEM-DUET-852): e o valor e os prazos do laudo da proposta.
  assert.match(fatos, /select\("property_id, agendado_para, proposta_em, valor_proposto, prazo_proposto_dias, prazo_laudo_dias_uteis, aguardando_avaliador, motivo_da_espera, reagendou_dono, reagendou_avaliador, avaliadores_credenciamento\(numero_credenciado, parceiros\(nome_publico, user_id\)\)"\)/);
  assert.match(fatos, /reagendada: ref\.reagendada \?\? \(pp\?\.reagendou_dono === true \|\| pp\?\.reagendou_avaliador === true\)/);
  assert.match(fatos, /visitaAnterior: ref\.visitaAnterior \?\? null/);
  assert.match(fatos, /destinatario: ref\.papel/);
});

test("E1160: sem os fatos, nenhum dos corpos novos deixa frase partida", () => {
  const variantes = [{}, { aguardandoAvaliador: true }, { reagendada: true }, { destinatario: "morador" as const }, { destinatario: "dono" as const }, { reagendada: true, visitaAnterior: VISITA }];
  for (const ev of EVENTOS_VISTORIA_COM_FATOS) {
    for (const extra of variantes) {
      const c = corpoVistoria(ev as never, { imovel: null, ...extra });
      for (const s of [c.body(), c.body("Lara")]) assert.doesNotMatch(s, /undefined|null|NaN|—|\s{2}| ,|\.\.|: ;|: \./, `${ev} ${JSON.stringify(extra)}: "${s}"`);
    }
  }
});
