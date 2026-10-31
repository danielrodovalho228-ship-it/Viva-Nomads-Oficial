/*
  E267 (reativação da vigia, 30/10) — os casos REAIS que o QA viu na caixa de teste entre 15:21 e 15:42 UTC, antes do
  deploy do #1600 (16:17 UTC): cada um tem de sair agora com a pessoa nomeada NAS DUAS CÓPIAS e o fato no corpo, e
  nenhuma das frases genéricas de antes pode voltar.
  Roda: node --test src/lib/notifications/e267-casos-reais.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { aberturaDoPedido, type PedidoParaEmail } from "../parceiros/email-pedido.ts";
import { aberturaEstadia, type DadosEstadiaEmail } from "./transacionais-estadia.ts";
import { TEMPLATES } from "./eventos-email.ts";

/** As frases genéricas que o QA recebeu (corpo antigo). */
const ANTIGAS = [
  "Olá, o horário do serviço está confirmado. Os detalhes estão no pedido.",
  "o horário do serviço está confirmado. Os detalhes estão no pedido",
  "a estadia foi renovada e a data do serviço mudou. Confirme um dos novos horários",
  "a saída do morador mudou e este pedido foi cancelado",
  "a outra parte respondeu à sua proposta de alteração",
  "a outra parte propôs uma alteração no contrato",
  "o aditivo foi assinado pelas duas partes. As datas e os blocos",
];

const PEDIDO: PedidoParaEmail = {
  codigo: "VN-SV-QA3010",
  servico: "Limpeza de saída",
  imovel: { titulo: "Apto Santa Mônica", bairro: "Santa Mônica", cidade: "Uberlândia" },
  horarioConfirmado: "2026-12-03T16:00:00Z",
  janela: { inicio: "2026-12-03T16:00:00Z", fim: "2026-12-05T14:00:00Z" },
  outraParte: "Daniel",
};
const ESTADIA: DadosEstadiaEmail = {
  imovel: { titulo: "Apto Santa Mônica", bairro: "Santa Mônica", cidade: "Uberlândia" },
  quem: "Fernanda",
  numeroAditivo: 1,
  mudancas: "Saída: de 30/11/2026 para 15/12/2026",
  prazo: "2026-11-06T15:00:00Z",
  entrada: "2026-11-01",
  saida: "2026-12-15",
};
const semAntiga = (txt: string) => {
  for (const a of ANTIGAS) assert.ok(!txt.includes(a), `voltou a frase genérica: "${a}" em "${txt}"`);
};

test("Horário do serviço confirmado: as DUAS cópias (cliente e parceiro) com o nome, com quem e o horário (03/12 às 13:00)", () => {
  // O servidor monta a outra parte vista por quem recebe: o nome público do parceiro para o cliente, o 1º nome do
  // cliente para o parceiro (pedidoParaEmail). E267 (resíduo, 31/10): o corpo diz com quem é o serviço.
  for (const [nome, outra] of [["Daniel", "Lara Limpa"], ["Lara", "Daniel"]] as const) {
    const t = aberturaDoPedido("parceiro_horario_confirmado", { ...PEDIDO, outraParte: outra }, nome);
    assert.equal(t, `Olá ${nome}, o horário do serviço de limpeza de saída em Apto Santa Mônica com ${outra} está confirmado: 03/12/2026 às 13:00 (horário de Brasília).`);
    semAntiga(t);
  }
});

test("Pedido mudou de data (pedido_auto_atualizado → parceiro): nome, imóvel e a nova data", () => {
  const t = aberturaDoPedido("pedido_auto_atualizado", { ...PEDIDO, horarioConfirmado: null }, "Lara", { reagendado: true });
  assert.match(t, /^Olá Lara, a estadia em Apto Santa Mônica foi renovada e a data do serviço de limpeza de saída pedido por Daniel mudou \(janela: 03\/12\/2026 às 13:00 a 05\/12\/2026 às 11:00\)/);
  semAntiga(t);
});

test("Pedido cancelado (pedido_auto_cancelado → parceiro): nome, imóvel e a nova saída", () => {
  const t = aberturaDoPedido("pedido_auto_cancelado", PEDIDO, "Lara", { cancelamento: { motivo: "saida_remarcada", novaSaida: "2026-12-15" } });
  assert.equal(t, "Olá Lara, a saída do morador mudou (nova saída: 15/12/2026) e o pedido de limpeza de saída feito por Daniel em Apto Santa Mônica foi cancelado. O pedido volta a ser feito perto da nova data.");
  assert.equal(
    aberturaDoPedido("pedido_auto_cancelado", PEDIDO, "Lara", { cancelamento: { motivo: "contrato_encerrado" } }),
    "Olá Lara, o contrato em Apto Santa Mônica foi encerrado e o pedido de limpeza de saída feito por Daniel foi cancelado. Nada a fazer.",
  );
  semAntiga(t);
});

test("Aditivo: quem propôs/respondeu e o imóvel em vez de 'a outra parte'; as duas cópias da assinatura nomeadas", () => {
  const proposto = aberturaEstadia("estadia_aditivo_proposto", ESTADIA, "Daniel");
  assert.match(proposto, /^Olá Daniel, Fernanda propôs uma alteração no contrato de Apto Santa Mônica: Saída: de 30\/11\/2026 para 15\/12\/2026\. Aceite ou recuse até 06\/11\/2026/);
  const respondido = aberturaEstadia("estadia_aditivo_respondido", { ...ESTADIA, quem: "Daniel", resposta: "aceita" }, "Fernanda");
  assert.match(respondido, /^Olá Fernanda, Daniel aceitou a sua proposta de alteração do contrato de Apto Santa Mônica/);
  for (const nome of ["Daniel", "Fernanda"]) {
    const assinado = aberturaEstadia("estadia_remarcada", ESTADIA, nome);
    assert.match(assinado, new RegExp(`^Olá ${nome}, o aditivo 1 do contrato de Apto Santa Mônica foi assinado pelas duas partes: Saída: de 30/11/2026 para 15/12/2026\\. A estadia agora vai de 01/11/2026 a 15/12/2026\\.`));
  }
  for (const t of [proposto, respondido]) semAntiga(t);
});

test("os 4 eventos usam o corpo do E267 em produção (não o do modelo genérico) e o nome vem do perfil ou do nome público", () => {
  // pedido: o servidor monta o corpo com aberturaDoPedido para todo evento do pedido; estadia: com aberturaEstadia.
  assert.match(readFileSync("src/lib/parceiros/pedido-servidor.ts", "utf8"), /body: \(nome\?: string\) => aberturaDoPedido\(ev as EventoPedido, ped, nome, opcoes\.fato\)/);
  assert.match(readFileSync("src/lib/data/estadia-actions.ts", "utf8"), /body: \(nome\?: string\) => aberturaEstadia\(event as EventoEstadia, dados, nome\)/);
  // Quem chama sem nome (ou parceiro sem nome no perfil) ainda é saudado: perfil → nome público do parceiro.
  const idx = readFileSync("src/lib/notifications/index.ts", "utf8");
  assert.match(idx, /async function nomeDoDestinatario[\s\S]{0,600}from\("parceiros"\)\.select\("nome_publico"\)/);
  // O modelo genérico continua só como reserva (sem imóvel): é ele que o QA viu antes do deploy.
  assert.match(TEMPLATES.parceiro_horario_confirmado.body("Lara"), /^Olá Lara,/);
});

test("cron das automações: o lembrete do serviço e a conclusão pendente saem pelo corpo do E267 (não o genérico)", () => {
  const cron = readFileSync("src/app/api/cron/automacoes/route.ts", "utf8");
  assert.match(cron, /parceiros\(user_id, nome_publico\)/);
  assert.match(cron, /body: \(nome\?: string\) => aberturaDoPedido\(ev, ped, nome\)/);
  assert.match(cron, /tipo: "parceiro_lembrete"[^\n]*\.\.\.corpoPedido\("parceiro_lembrete", quem === p\.cliente_id\)/);
  assert.match(cron, /tipo: "parceiro_conclusao_pendente"[^\n]*\.\.\.corpoPedido\("parceiro_conclusao_pendente", true\)/);
  // O corpo que sai: serviço, imóvel e horário; para o cliente, quem é o parceiro.
  const lembrete = aberturaDoPedido("parceiro_lembrete", PEDIDO, "Lara");
  assert.equal(lembrete, "Olá Lara, o serviço de limpeza de saída em Apto Santa Mônica está marcado para 03/12/2026 às 13:00 (horário de Brasília).");
  const pendente = aberturaDoPedido("parceiro_conclusao_pendente", { ...PEDIDO, outraParte: "Lara Limpa" }, "Daniel");
  assert.match(pendente, /^Olá Daniel, Lara Limpa marcou a entrega do serviço de limpeza de saída em Apto Santa Mônica há 7 dias\./);
  for (const t of [lembrete, pendente]) assert.doesNotMatch(t, /próximas horas|o parceiro marcou a entrega há 7 dias/);
});
