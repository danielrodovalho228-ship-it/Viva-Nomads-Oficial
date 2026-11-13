/*
  E267 (restante): todo e-mail a cliente nomeia no CORPO a pessoa, o imóvel (quando há um) e o fato.
  Antes, mensagem nova, manutenção nova, lembrete da entrada, preço justo e os três e-mails de chamado abriam com a
  frase genérica do modelo (sem o imóvel, sem quem escreveu, sem o número do chamado).
  Roda: node --test src/lib/notifications/corpo-e267-restante.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { corpoChamado, corpoLembreteEntrada, corpoManutencaoNova, corpoMensagemNova, corpoPrecoJustoAcima, seguro } from "./corpo-e267-restante.ts";

const fonte = (p: string) => readFileSync(p, "utf8");

test("mensagem nova: nomeia a pessoa, quem escreveu e o imóvel da conversa", () => {
  const b = corpoMensagemNova({ remetente: "Ana", imovelTitulo: "Apto Santa Mônica" })("Bruno");
  assert.equal(b, "Olá Bruno, Ana mandou uma mensagem para você no Viva Nomads sobre Apto Santa Mônica. Responda pela plataforma.");
  // Conversa sem imóvel (pedido de moradia): a frase fecha sem "sobre".
  assert.doesNotMatch(corpoMensagemNova({ remetente: "Ana" })("Bruno"), /sobre/);
});

test("manutenção nova: imóvel, urgência e prazo no corpo; lembrete diz que ainda espera", () => {
  const prazo = new Date("2026-11-13T13:00:00Z");
  const b = corpoManutencaoNova({ imovelTitulo: "Casa Jardim Karaíba", urgente: true, prazo })("Carla");
  assert.equal(b, "Olá Carla, o morador abriu um pedido de manutenção urgente em Casa Jardim Karaíba. Responda pela plataforma até 13/11/2026 às 10:00 (horário de Brasília).");
  const l = corpoManutencaoNova({ imovelTitulo: "Casa Jardim Karaíba", urgente: false, prazo, lembrete: true })("Carla");
  assert.match(l, /o pedido de manutenção em Casa Jardim Karaíba ainda espera a sua resposta/);
  // O servidor usa "seu imóvel" quando o anúncio não tem título: não vira "em seu imóvel".
  assert.match(corpoManutencaoNova({ imovelTitulo: "seu imóvel", urgente: false, prazo })(), /^Olá, o morador abriu um pedido de manutenção no seu imóvel\./);
});

test("lembrete da entrada: imóvel, data e horário; morador e proprietário com o sujeito certo", () => {
  const m = corpoLembreteEntrada({ imovelTitulo: "Apto Centro", entrada: "2026-11-15", amanha: true, horario: "14:00", morador: true })("Davi");
  assert.equal(m, "Olá Davi, a sua entrada em Apto Centro é amanhã (15/11/2026), a partir das 14:00. Confira o horário e as instruções de entrada pela plataforma.");
  const p = corpoLembreteEntrada({ imovelTitulo: "Apto Centro", entrada: "2026-11-15", amanha: false, horario: null, morador: false })("Eva");
  assert.equal(p, "Olá Eva, a entrada do morador em Apto Centro é em 15/11/2026. Confira o horário e as instruções de entrada pela plataforma.");
});

test("preço justo: imóvel e os três valores no corpo", () => {
  const b = corpoPrecoJustoAcima({ imovelTitulo: "Studio Fundinho", totalViva: 4100, valorAirbnb: 3900, ate: 3800 })("Fábio");
  assert.match(b, /^Olá Fábio, o total por mês de Studio Fundinho na Viva \(R\$ 4\.100\) ficou igual ou acima do mesmo imóvel no Airbnb \(R\$ 3\.900 em 30 noites/);
  assert.match(b, /até R\$ 3\.800, ele volta/);
});

test("chamado: número e assunto no corpo dos três e-mails", () => {
  const d = { numero: "AJ-1042", assunto: "Não consigo pagar o boleto" };
  assert.equal(corpoChamado("chamado_aberto", d)("Gil"), "Olá Gil, recebemos seu chamado AJ-1042 (Não consigo pagar o boleto) na Central de Ajuda do Viva Nomads. Você acompanha e responde por lá.");
  assert.equal(corpoChamado("chamado_respondido", d)("Gil"), "Olá Gil, a equipe Viva Nomads respondeu seu chamado AJ-1042 (Não consigo pagar o boleto).");
  assert.match(corpoChamado("chamado_resolvido", d)("Gil"), /marcamos seu chamado AJ-1042 \(Não consigo pagar o boleto\) como resolvido/);
});

test("texto do usuário no corpo vale no HTML e no texto: sem marcação e sem link", () => {
  assert.equal(seguro('Casa <b>"top"</b> & cia'), "Casa btop/b e cia");
  assert.match(seguro("Apto veja www.golpe.com"), /\[link removido\]/);
  const b = corpoMensagemNova({ remetente: "<script>x</script>", imovelTitulo: "A&B" })();
  assert.doesNotMatch(b, /[<>]/);
});

test("pontos de envio: cada um passa o corpo que nomeia pessoa, imóvel e fato", () => {
  assert.match(fonte("src/lib/data/actions.ts"), /event: "new_message",[\s\S]{0,400}body: corpoMensagemNova\(\{ remetente: senderName, imovelTitulo \}\)/);
  assert.match(fonte("src/lib/atendimento/servidor.ts"), /event: "manutencao_nova",[\s\S]{0,600}body: corpoManutencaoNova\(/);
  assert.match(fonte("src/lib/atendimento/servidor.ts"), /event: evento,[\s\S]{0,400}body: corpoChamado\(evento, \{ numero: c\.numero_publico, assunto: c\.assunto \}\)/);
  assert.match(fonte("src/app/api/cron/checkin-lembretes/route.ts"), /event: "checkin_lembrete",[\s\S]{0,400}body: corpoLembreteEntrada\(/);
  assert.match(fonte("src/lib/comparador-airbnb/comparacao-servidor.ts"), /event: "preco_justo_acima",[\s\S]{0,400}body: corpoPrecoJustoAcima\(/);
});
