/*
  E267 — a régua dos e-mails transacionais de serviço e de estadia/aditivo: o corpo nomeia (a) a pessoa, (b) o imóvel
  (título · bairro, cidade) e (c) o fato concreto. Da outra parte, só o primeiro nome (ou o nome público do parceiro);
  nunca o endereço exato. Os textos que já passavam (código de assinatura e lembrete de bloco) não mudam.
  Roda: node --test src/lib/notifications/transacionais-e267.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { EVENTOS_DO_PEDIDO, aberturaDoPedido, linhasDoPedido, type EventoPedido, type FatoDoPedido, type PedidoParaEmail } from "../parceiros/email-pedido.ts";
import { EVENTOS_DA_ESTADIA, aberturaEstadia, linhaImovel, linhasEstadia, type DadosEstadiaEmail, type EventoEstadia } from "./transacionais-estadia.ts";
import { detalheAutomacao } from "../automacoes/regras.ts";
import { emailCodigoAssinatura } from "./montar-email.ts";
import { TEMPLATES } from "./eventos-email.ts";

const IMOVEL = "Studio Jardim · Jardim Karaíba, Uberlândia";
const corpo = (abertura: string, linhas: { rotulo: string; valor: string }[]) => [abertura, ...linhas.map((l) => `${l.rotulo}: ${l.valor}`)].join("\n");

const PEDIDO: PedidoParaEmail = {
  codigo: "VN-SV-E267TEST",
  servico: "Limpeza completa",
  imovel: { titulo: "Studio Jardim", bairro: "Jardim Karaíba", cidade: "Uberlândia" },
  janela: { inicio: "2026-12-03T16:00:00Z", fim: "2026-12-05T14:00:00Z" },
  horarios: ["2026-12-03T16:00:00Z"],
  valorCombinado: 250,
  valorParceiro: 225,
  outraParte: "Lara Limpa",
};

/** O fato que cada evento tem de dizer (no corpo: abertura + bloco). */
const CASOS_PEDIDO: { ev: EventoPedido; p?: Partial<PedidoParaEmail>; fato?: FatoDoPedido; diz: (string | RegExp)[] }[] = [
  { ev: "parceiro_pedido_novo", diz: ["pedido de orçamento de limpeza completa para Studio Jardim, feito por Lara Limpa"] },
  { ev: "parceiro_orcamento_recebido", diz: ["Lara Limpa enviou o orçamento de limpeza completa para Studio Jardim: R$ 250"] },
  { ev: "parceiro_orcamento_aceito", diz: ["boa notícia: Lara Limpa aceitou o seu orçamento de limpeza completa para Studio Jardim (R$ 250)", "Você recebe: R$ 225"] },
  { ev: "parceiro_pedido_recusado", diz: ["Lara Limpa recusou o pedido de limpeza completa"] },
  { ev: "parceiro_pedido_recusado", fato: { novaDataRecusada: { cancelado: true } }, diz: ["Lara Limpa recusou a nova data", "O pedido foi cancelado"] },
  { ev: "parceiro_horario_confirmado", p: { horarioConfirmado: "2026-12-03T16:00:00Z" }, diz: ["está confirmado: 03/12/2026 às 13:00", "Data: 03/12/2026 às 13:00"] },
  { ev: "parceiro_horario_confirmado", fato: { horarioProposto: "2026-12-04T12:30:00Z" }, diz: ["Lara Limpa propôs outro horário", "04/12/2026 às 09:30", "Horário proposto: 04/12/2026 às 09:30"] },
  { ev: "parceiro_lembrete", p: { horarioConfirmado: "2026-12-03T16:00:00Z" }, diz: ["marcado para 03/12/2026 às 13:00"] },
  { ev: "parceiro_entrega_feita", diz: ["Lara Limpa marcou o serviço de limpeza completa em Studio Jardim como entregue"] },
  { ev: "parceiro_conclusao_pendente", diz: ["há 7 dias", "Nada é concluído sem você"] },
  { ev: "parceiro_avaliacao", diz: ["foi concluído", "com Lara Limpa"] },
  { ev: "pedido_auto_confirmar", diz: ["com Lara Limpa", /janela: 03\/12\/2026 às 13:00 a 05\/12\/2026 às 11:00/] },
  { ev: "pedido_auto_sem_resposta", diz: ["Lara Limpa não respondeu em 24 horas"] },
  { ev: "pedido_auto_atualizado", diz: ["foi remarcada", "janela: 03/12/2026"] },
  { ev: "pedido_auto_atualizado", fato: { reagendado: true }, diz: ["foi renovada", "O valor combinado continua o mesmo."] },
  { ev: "pedido_auto_cancelado", fato: { cancelamento: { motivo: "saida_remarcada", novaSaida: "2027-01-05" } }, diz: ["a saída do morador mudou (nova saída: 05/01/2027)", "Nova saída: 05/01/2027"] },
  { ev: "pedido_auto_cancelado", fato: { cancelamento: { motivo: "nova_data_recusada", novaSaida: "2027-01-05" } }, diz: ["você recusou a nova data (nova saída: 05/01/2027)"] },
  { ev: "pedido_auto_cancelado", fato: { cancelamento: { motivo: "contrato_encerrado" } }, diz: ["o contrato em Studio Jardim foi encerrado"] },
];

test("E267: todo evento do pedido de serviço nomeia a pessoa, o imóvel e o fato", () => {
  for (const c of CASOS_PEDIDO) {
    const p = { ...PEDIDO, ...c.p };
    const texto = corpo(aberturaDoPedido(c.ev, p, "Dora", c.fato), linhasDoPedido(c.ev, p, c.fato));
    // E267 (resíduo): uma saudação só, em todos ("Boa notícia, X!" saiu do orçamento aceito).
    assert.match(texto, /^Olá Dora,/, `${c.ev}: saudação com o nome`);
    assert.ok(texto.includes("Studio Jardim"), `${c.ev}: o imóvel na abertura`);
    assert.ok(texto.includes(`Imóvel: ${IMOVEL}`), `${c.ev}: o imóvel por extenso no bloco`);
    for (const f of c.diz) assert.ok(typeof f === "string" ? texto.includes(f) : f.test(texto), `${c.ev}: ${f}\n${texto}`);
    assert.doesNotMatch(texto, /a outra parte/, c.ev);
  }
  // Cada evento do pedido tem caso aqui.
  for (const ev of EVENTOS_DO_PEDIDO) assert.ok(CASOS_PEDIDO.some((c) => c.ev === ev), `${ev} sem caso`);
});

test("E267: 'Horário do serviço confirmado' diz QUAL horário (o caso do circuito de 30/10: 03/12 13h)", () => {
  const p = { ...PEDIDO, horarioConfirmado: "2026-12-03T16:00:00Z" };
  assert.equal(aberturaDoPedido("parceiro_horario_confirmado", p, "Daniel"), "Olá Daniel, o horário do serviço de limpeza completa em Studio Jardim com Lara Limpa está confirmado: 03/12/2026 às 13:00 (horário de Brasília).");
  // Sem a outra parte (perfil sem nome), a frase continua inteira.
  assert.equal(aberturaDoPedido("parceiro_horario_confirmado", { ...p, outraParte: null }, "Daniel"), "Olá Daniel, o horário do serviço de limpeza completa em Studio Jardim está confirmado: 03/12/2026 às 13:00 (horário de Brasília).");
});

const ESTADIA: DadosEstadiaEmail = {
  imovel: { titulo: "Studio Jardim", bairro: "Jardim Karaíba", cidade: "Uberlândia" },
  quem: "Ana",
  numeroAditivo: 2,
  mudancas: "Meses: de 2 para 4",
  prazo: "2026-11-06T18:00:00Z",
  entrada: "2026-10-01",
  saida: "2027-01-28",
  motivo: "Mudança de cidade",
};

const CASOS_ESTADIA: { ev: EventoEstadia; d?: Partial<DadosEstadiaEmail>; diz: string[] }[] = [
  { ev: "estadia_aditivo_proposto", diz: ["Ana propôs uma alteração no contrato de Studio Jardim: Meses: de 2 para 4", "até 06/11/2026", "Responder até: 06/11/2026"] },
  { ev: "estadia_aditivo_respondido", d: { resposta: "aceita" }, diz: ["Ana aceitou a sua proposta", "Resposta: Aceita por Ana"] },
  { ev: "estadia_aditivo_respondido", d: { resposta: "recusada" }, diz: ["Ana recusou a sua proposta", "Nada muda no contrato."] },
  { ev: "estadia_aditivo_respondido", d: { resposta: "assinada" }, diz: ["Ana assinou o aditivo 2 do contrato de Studio Jardim", "Falta a sua assinatura"] },
  { ev: "estadia_remarcada", diz: ["o aditivo 2 do contrato de Studio Jardim foi assinado pelas duas partes: Meses: de 2 para 4", "vai de 01/10/2026 a 28/01/2027"] },
  { ev: "estadia_encerramento_pedido", diz: ["Ana pediu o encerramento do contrato de Studio Jardim (motivo: mudança de cidade)", "Pedido por: Ana"] },
  { ev: "saida_sem_parceiro", diz: ["o morador sai de Studio Jardim em 28/01/2027", "Saída: 28/01/2027"] },
  { ev: "sugestao_parceiros_morador", d: { momento: "saida" }, diz: ["a sua saída de Studio Jardim em 28/01/2027"] },
  { ev: "sugestao_parceiros_morador", d: { momento: "entrada" }, diz: ["a sua entrada em Studio Jardim em 01/10/2026", "Entrada: 01/10/2026"] },
];

test("E267: estadia e aditivo nomeiam a pessoa, o imóvel e quem agiu (nunca \"a outra parte\")", () => {
  for (const c of CASOS_ESTADIA) {
    const d = { ...ESTADIA, ...c.d };
    const texto = corpo(aberturaEstadia(c.ev, d, "Dora"), linhasEstadia(c.ev, d));
    assert.match(texto, /^Olá Dora,/, `${c.ev}: saudação`);
    assert.ok(texto.includes(`Imóvel: ${IMOVEL}`), `${c.ev}: o imóvel por extenso`);
    for (const f of c.diz) assert.ok(texto.includes(f), `${c.ev}: ${f}\n${texto}`);
    assert.doesNotMatch(texto, /a outra parte/, c.ev);
  }
  for (const ev of EVENTOS_DA_ESTADIA) assert.ok(CASOS_ESTADIA.some((c) => c.ev === ev), `${ev} sem caso`);
});

test("E267: sem nome, a saudação fica neutra (nunca \"Olá undefined\"); sem quem agiu, nada inventado", () => {
  assert.match(aberturaEstadia("estadia_aditivo_proposto", { imovel: ESTADIA.imovel }), /^Olá, a outra parte propôs/);
  assert.match(aberturaDoPedido("parceiro_entrega_feita", { ...PEDIDO, outraParte: null }), /^Olá, o parceiro marcou/);
});

test("E267: o imóvel é título · bairro, cidade — nunca o endereço exato (não há campo para ele)", () => {
  assert.equal(linhaImovel(ESTADIA.imovel), IMOVEL);
  assert.equal(linhaImovel({ titulo: "Studio", cidade: "Uberlândia" }), "Studio · Uberlândia");
  for (const src of ["src/lib/parceiros/pedido-servidor.ts", "src/lib/data/estadia.ts", "src/lib/automacao/servidor.ts", "src/app/api/cron/automacoes/route.ts"]) {
    assert.doesNotMatch(readFileSync(src, "utf8"), /exact_address/, `${src} não lê o endereço exato`);
  }
});

test("E267: os lembretes do cron levam o imóvel por extenso e o serviço", () => {
  const im = linhaImovel(ESTADIA.imovel);
  assert.match(detalheAutomacao("parceiro_lembrete", { imovel: im, numero: "VN-SV-1", quando: "03/12/2026 às 13:00", servico: "Limpeza completa" }), /Imóvel: Studio Jardim · Jardim Karaíba, Uberlândia\. Pedido VN-SV-1: serviço de limpeza completa marcado para 03\/12\/2026 às 13:00/);
  assert.match(detalheAutomacao("parceiro_conclusao_pendente", { imovel: im, numero: "VN-SV-1", servico: "Limpeza completa" }), /Imóvel: Studio Jardim · Jardim Karaíba, Uberlândia\. Pedido VN-SV-1 \(limpeza completa\)/);
  assert.match(detalheAutomacao("saida_lembrete", { imovel: im, fim: "2027-01-28" }), /Imóvel: Studio Jardim · Jardim Karaíba, Uberlândia\. Saída em 28\/01\/2027/);
});

test("E267: regressão — o código de assinatura e o lembrete de bloco não mudam de texto", () => {
  const m = emailCodigoAssinatura("https://vivanomads.com.br", { imovel: "Studio Jardim (aditivo 2)", codigo: "042917" });
  assert.match(m.text, /Studio Jardim \(aditivo 2\)/);
  assert.match(m.text, /042917/);
  assert.match(TEMPLATES.bloco_inicio_lembrete.subject, /\S/);
  // Os dois arquivos ficam fora do E267 (a revisão confere pelo diff; aqui, que nenhum dos dois importa os módulos novos).
  for (const src of ["src/lib/estadia/lembrete-bloco.ts", "src/lib/estadia/lembrete-bloco-servidor.ts"]) {
    assert.doesNotMatch(readFileSync(src, "utf8"), /transacionais-estadia|FatoDoPedido/, src);
  }
});

test("E267: quem chama sem o nome ainda recebe a saudação (o notify busca o primeiro nome e, no parceiro, o nome público)", () => {
  const src = readFileSync("src/lib/notifications/index.ts", "utf8");
  assert.match(src, /async function nomeDoDestinatario/);
  assert.match(src, /from\("parceiros"\)\.select\("nome_publico"\)/);
  // A estadia passa o nome (antes ia só o e-mail).
  assert.match(readFileSync("src/lib/data/estadia-actions.ts", "utf8"), /name: \(perfil as \{ full_name: string \| null \} \| null\)\?\.full_name/);
});
