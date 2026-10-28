import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  LINHA_DINHEIRO,
  MOTIVO_EXPIROU,
  boasVindas,
  detalhes,
  linhaDoTempoMorador,
  pedidoDeVisitaExpirou,
  perfilDasBoasVindas,
  propostaAceitaDono,
  propostaAceitaMorador,
  propostaRecusada,
  vesperaDaVisita,
  vesperaTexto,
  visitaCancelada,
} from "./emails-e205b.ts";
import { comMarca, problemasDoAssunto } from "./assuntos.ts";

const ler = (p: string) => readFileSync(new URL(p, import.meta.url), "utf8");
const agora = new Date("2026-10-28T15:00:00Z");

test("(a) boas-vindas: perfil pela intenção; 3 passos, um botão, a linha do dinheiro", () => {
  assert.equal(perfilDasBoasVindas(["anunciar"], null), "proprietario");
  assert.equal(perfilDasBoasVindas(["morar"], "owner"), "morador");
  assert.equal(perfilDasBoasVindas(["morar", "anunciar"], "owner"), "proprietario");
  assert.equal(perfilDasBoasVindas([], null), "morador");
  const m = boasVindas("morador");
  assert.equal(m.titulo, "Como achar e garantir o seu imóvel");
  assert.equal(m.passos.length, 3);
  assert.match(m.passos.join(" "), /^Buscar.*Conversar ou visitar.*Receber a proposta/);
  assert.equal(m.cta, "Começar a buscar");
  const p = boasVindas("proprietario");
  assert.equal(p.titulo, "Como anunciar");
  assert.match(p.passos.join(" "), /^Qualificação.*Cadastro.*Publicar/);
  assert.equal(p.cta, "Anunciar meu imóvel");
  for (const e of [m, p]) {
    assert.equal(e.rodape, "A Viva não recebe nem guarda dinheiro: o pagamento é direto entre vocês.");
    assert.deepEqual(problemasDoAssunto(comMarca(e.assunto)), []);
  }
});

test("(b) aceite: dono com o primeiro nome e 'Preparar o contrato'; morador com a linha do tempo e só os prazos do sistema", () => {
  const d = propostaAceitaDono({ nomeMorador: "Ana Souza Lima", leadId: "L1" });
  assert.equal(d.assunto, "Proposta aceita: Ana quer morar no seu imóvel");
  assert.equal(d.cta, "Preparar o contrato");
  assert.equal(d.url, "/dashboard/fechamento?c=L1");
  assert.doesNotMatch(d.assunto, /Souza/);
  assert.equal(propostaAceitaDono({ nomeMorador: null, leadId: "L1" }).assunto, "Proposta aceita: o morador quer morar no seu imóvel");

  const etapas = linhaDoTempoMorador("2026-11-10");
  assert.deepEqual(etapas.map((e) => e.prazo), [null, "até a entrada, em 10/11/2026", null, "7 dias antes da entrada, em 03/11/2026"]);
  assert.match(etapas[0].rotulo, /^Contrato para assinar/);
  assert.match(etapas[1].rotulo, /^Caução/);
  assert.match(etapas[2].rotulo, /^Primeiro pagamento/);
  assert.match(etapas[3].rotulo, /^Instruções de chegada/);
  // Sem data de entrada: nenhum prazo inventado.
  assert.deepEqual(linhaDoTempoMorador(null).map((e) => e.prazo), [null, null, null, "7 dias antes da entrada"]);
  const m = propostaAceitaMorador({ dataEntrada: "2026-11-10", propostaId: "P1" });
  assert.equal(m.assunto, "Você garantiu o seu próximo lar");
  assert.equal(m.cta, "Ver os próximos passos");
  for (const e of [d, m]) assert.deepEqual(problemasDoAssunto(comMarca(e.assunto)), []);
});

test("(c) recusa: '{Primeiro nome} recusou a proposta', motivo quando houver, botão por lado", () => {
  const aoDono = propostaRecusada({ quemRecusou: "tenant", nomeDeQuemRecusou: "Ana Souza", motivo: "Datas", texto: null, propostaId: "P1" });
  assert.equal(aoDono.assunto, "Ana recusou a proposta");
  assert.match(aoDono.abertura("Carlos"), /^Olá Carlos, Ana recusou a proposta\. Motivo: Datas\./);
  assert.equal(aoDono.cta, "Ajustar e enviar nova versão");
  assert.equal(aoDono.url, "/dashboard/propostas/P1");
  const aoMorador = propostaRecusada({ quemRecusou: "owner", nomeDeQuemRecusou: "", motivo: null, propostaId: "P1", cidade: "Uberlândia" });
  assert.equal(aoMorador.assunto, "O proprietário recusou a proposta");
  assert.doesNotMatch(aoMorador.abertura(), /Motivo/);
  assert.equal(aoMorador.cta, "Ver outros imóveis parecidos");
  assert.equal(aoMorador.url, "/buscar?cidade=Uberl%C3%A2ndia");
  for (const e of [aoDono, aoMorador]) assert.deepEqual(problemasDoAssunto(comMarca(e.assunto)), []);
});

test("(d) cancelada: quem, motivo e horário; ao morador, 'Pedir outro horário'", () => {
  const t = visitaCancelada({ quemCancelou: "dono", nomeDeQuemCancelou: "Carlos Lima", motivo: "Imóvel alugado", horario: "qui., 05/11 às 10:00", tipo: "presencial", imovel: "Apto", propertyId: "I1", paraMorador: true });
  assert.match(t.abertura("Ana"), /^Olá Ana, Carlos cancelou a visita presencial\./);
  assert.deepEqual(t.linhas.map((l) => l.rotulo), ["Imóvel", "Visita", "Horário", "Cancelada por", "Motivo"]);
  assert.equal(t.cta, "Pedir outro horário");
  assert.equal(t.url, "/imoveis/I1");
  const aoDono = visitaCancelada({ quemCancelou: "morador", motivo: null, tipo: "por vídeo", propertyId: "I1", paraMorador: false });
  assert.equal(aoDono.cta, "Ver as visitas");
  assert.ok(!aoDono.linhas.some((l) => l.rotulo === "Motivo"));
});

test("(d) expirada: só pedido com TODOS os horários passados; motivo 'expirou'", () => {
  const passados = ["2026-10-21T13:00:00Z", "2026-10-22T13:00:00Z"];
  assert.equal(MOTIVO_EXPIROU, "expirou");
  assert.equal(pedidoDeVisitaExpirou({ status: "pedido", horarios: passados }, agora), true);
  assert.equal(pedidoDeVisitaExpirou({ status: "pedido", horarios: [...passados, "2026-10-30T13:00:00Z"] }, agora), false);
  for (const status of ["confirmado", "remarcar", "cancelado", "feito"]) assert.equal(pedidoDeVisitaExpirou({ status, horarios: passados }, agora), false);
  assert.equal(pedidoDeVisitaExpirou({ status: "pedido", horarios: [] }, agora), false);
});

test("(d) véspera: confirmada, não passada, até 24 h; textos por lado e modalidade", () => {
  const em = (h: number) => new Date(agora.getTime() + h * 3600_000).toISOString();
  assert.equal(vesperaDaVisita({ status: "confirmado", horarioConfirmado: em(23.9) }, agora), true);
  assert.equal(vesperaDaVisita({ status: "confirmado", horarioConfirmado: em(2) }, agora), true, "confirmada com < 24 h: sai na hora");
  assert.equal(vesperaDaVisita({ status: "confirmado", horarioConfirmado: em(25) }, agora), false);
  assert.equal(vesperaDaVisita({ status: "confirmado", horarioConfirmado: em(-1) }, agora), false);
  assert.equal(vesperaDaVisita({ status: "pedido", horarioConfirmado: em(5) }, agora), false);

  const end = { texto: "Rua A, 10 · Centro · Uberlândia", mapa: "https://www.google.com/maps/search/?api=1&query=Rua%20A" };
  const morador = vesperaTexto({ modalidade: "presencial", paraMorador: true, horario: "qui., 05/11 às 10:00 (horário de Brasília)", endereco: end, nomeMorador: "Ana" });
  assert.equal(morador.cta, "Abrir no mapa");
  assert.equal(morador.url, end.mapa);
  assert.ok(morador.linhas.some((l) => l.rotulo === "Endereço" && l.valor === end.texto));
  const dono = vesperaTexto({ modalidade: "presencial", paraMorador: false, horario: "x", endereco: end, nomeMorador: "Ana Souza" });
  assert.ok(!dono.linhas.some((l) => l.rotulo === "Endereço"), "o dono não recebe endereço");
  assert.ok(dono.linhas.some((l) => l.rotulo === "Morador" && l.valor === "Ana"));
  const video = vesperaTexto({ modalidade: "video", paraMorador: false, horario: "x", linkChamada: "https://meet.google.com/abc" });
  assert.equal(video.cta, "Entrar na chamada");
  assert.equal(video.url, "https://meet.google.com/abc");
});

test("detalhes: link externo vira o ÚNICO botão; interno fica com o botão padrão; tudo escapado", () => {
  const ext = detalhes({ linhas: [{ rotulo: "Imóvel", valor: "<b>x</b>" }], externo: { label: "Abrir no mapa", url: "https://maps.example/?a=1&b=2" } });
  assert.equal((ext.html.match(/<a\s/g) ?? []).length, 1);
  assert.match(ext.html, /&lt;b&gt;x&lt;\/b&gt;/);
  assert.match(ext.html, /a=1&amp;b=2/);
  assert.match(ext.texto, /Abrir no mapa: https:\/\/maps\.example\/\?a=1&b=2/);
  const sem = detalhes({ titulo: "Passos", passos: ["um", "dois"], rodape: LINHA_DINHEIRO, externo: { label: "x", url: "javascript:alert(1)" } });
  assert.doesNotMatch(sem.html, /<a\s/);
  assert.match(sem.texto, /1\. um\n2\. dois/);
});

test("GUARDA: os chamadores — boas-vindas na 1ª entrada, aceite com 2 e-mails, recusa própria, visitas e cron", () => {
  const intencao = ler("../data/intencao-actions.ts");
  assert.match(intencao, /if \(primeiroAcesso\) \{[\s\S]{0,300}enviarBoasVindas\(admin, uid, intencao, modo\)/);
  const bv = ler("./boas-vindas-servidor.ts");
  assert.match(bv, /from\("automacoes_envios"\)\.insert\(\{ chave: CHAVE_BOAS_VINDAS\(usuarioId\)/);
  assert.match(bv, /if \(error\) return false;/);

  const prop = ler("../data/propostas-actions.ts");
  assert.match(prop, /await emailsDoAceite\(admin, p, termosDaLinha\(v\), linhaTaxa\);/);
  assert.match(prop, /event: "proposta_recusada"/);
  assert.equal((prop.match(/event: "proposta_aceita"/g) ?? []).length, 2);

  const visitas = ler("../data/visitas-video-actions.ts");
  assert.match(visitas, /after\(\(\) => avisarVisitaCancelada\(admin, v\.id as string, quem\)\)/);
  assert.match(visitas, /after\(\(\) => vesperaDaVisitaSeFor\(admin, v\.id as string, new Date\(\)\)/);
  assert.equal((visitas.match(/expirarDepois\(user\.id\);/g) ?? []).length, 2);
  const av = ler("../visitas/avisos-servidor.ts");
  assert.match(av, /update\(\{ status: "cancelado", motivo_recusa: MOTIVO_EXPIROU[^}]*\}\)\s*\.eq\("id", v\.id\)\s*\.eq\("status", "pedido"\)/);
  assert.match(av, /CHAVE_VESPERA\(v\.id, para, v\.horario_confirmado!\)/);
  // Endereço exato só na véspera presencial do morador.
  assert.match(av, /modalidade === "presencial" && paraMorador \? await enderecoExato/);
  const cron = ler("../../app/api/cron/automacoes/route.ts");
  assert.match(cron, /expirarVisitasVencidas\(admin, agora, \{ simular \}\)/);
  assert.match(cron, /vesperasDasVisitas\(admin, agora, simular\)/);
});
