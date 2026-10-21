import { test } from "node:test";
import assert from "node:assert/strict";
import { dividirValor } from "./regras.ts";
import {
  congelarValores,
  horarioNaAgenda,
  podeFazer,
  podeSimularPagamento,
  precisaAvisoConclusao,
  precisaLembrete24h,
  provedorSimulado,
  STATUS_PEDIDO,
  tetoAtingido,
  textoDivisaoParceiro,
  textoTeto,
  TRANSICOES,
  validarOrcamento,
  validarPedido,
  visaoDoParceiro,
  type AcaoPedido,
} from "./pedido.ts";

const AGORA = new Date("2026-10-21T12:00:00Z"); // quarta, 09:00 em Brasília

test("taxa de 10%: duas casas, meio para cima, e taxa + parceiro = valor", () => {
  assert.deepEqual(dividirValor(500), { taxa: 50, parceiro: 450 });
  assert.deepEqual(dividirValor(1.05), { taxa: 0.11, parceiro: 0.94 }, "10,5 centavos sobe para 11");
  assert.deepEqual(dividirValor(1.04), { taxa: 0.1, parceiro: 0.94 });
  assert.deepEqual(dividirValor(333.33), { taxa: 33.33, parceiro: 300 });
  for (const v of [0.01, 0.05, 1.15, 19.95, 250.25, 999.99, 1234.56, 99999.95]) {
    const { taxa, parceiro } = dividirValor(v);
    assert.equal(Math.round((taxa + parceiro) * 100), Math.round(v * 100), `soma 90/10 de ${v}`);
  }
  assert.equal(textoDivisaoParceiro(350), "Taxa de serviço da Viva: 10% = R$ 35,00. Você recebe R$ 315,00.");
});

test("valores congelam no aceite com a taxa da hora (0,100)", () => {
  assert.deepEqual(congelarValores(350), { valor_combinado: 350, taxa_percent: 0.1, valor_taxa: 35, valor_parceiro: 315 });
  assert.deepEqual(validarOrcamento("1.250,50"), { ok: true, valor: 1250.5 });
  assert.equal(validarOrcamento("0").ok, false);
  assert.equal(validarOrcamento(200_000).ok, false);
});

test("teto: no máximo 3 orçamentos abertos por categoria; o 4º é bloqueado com o texto", () => {
  assert.equal(tetoAtingido(2), false);
  assert.equal(tetoAtingido(3), true);
  assert.equal(textoTeto("limpeza"), "Você já tem 3 orçamentos abertos em limpeza: feche um para pedir outro.");
});

test("transições válidas e inválidas (quem pode e de onde)", () => {
  const validas: [AcaoPedido, string, "cliente" | "parceiro"][] = [
    ["orcar", "solicitado", "parceiro"],
    ["recusar_pedido", "solicitado", "parceiro"],
    ["aceitar_orcamento", "orcado", "cliente"],
    ["recusar_orcamento", "orcado", "cliente"],
    ["confirmar_horario", "aceito", "parceiro"],
    ["confirmar_horario_proposto", "aceito", "cliente"],
    ["iniciar", "agendado", "parceiro"],
    ["entregar", "em_execucao", "parceiro"],
    ["concluir", "entregue", "cliente"],
  ];
  for (const [a, s, p] of validas) assert.ok(podeFazer(a, s, p), `${a} de ${s} por ${p}`);
  assert.equal(podeFazer("aceitar_orcamento", "orcado", "parceiro"), false, "o parceiro não aceita o próprio orçamento");
  assert.equal(podeFazer("concluir", "em_execucao", "cliente"), false, "não conclui antes da entrega");
  assert.equal(podeFazer("entregar", "agendado", "parceiro"), false, "não entrega sem iniciar");
  assert.equal(podeFazer("orcar", "aceito", "parceiro"), false, "o valor não muda depois do aceite");
  assert.equal(podeFazer("concluir", "concluido", "cliente"), false);
  // Toda ação leva a um estado conhecido e nada sai de concluído, recusado ou cancelado.
  for (const t of Object.values(TRANSICOES)) {
    assert.ok((STATUS_PEDIDO as readonly string[]).includes(t.para));
    for (const fim of ["concluido", "recusado", "cancelado"]) assert.ok(!(t.de as readonly string[]).includes(fim));
  }
});

test("horários: até 3, futuros, dentro da agenda e fora dos bloqueios", () => {
  const agenda = { janelas: [{ dia: 4, inicio: "08:00", fim: "18:00" }], bloqueios: [{ inicio: "2026-10-22T17:00:00Z", fim: "2026-10-22T19:00:00Z" }] };
  // quinta 22/10: 10:00 em Brasília = 13:00Z (ok); 14:30 = 17:30Z (bloqueado); 19:00 = 22:00Z (fora da janela)
  assert.ok(horarioNaAgenda("2026-10-22T13:00:00Z", agenda.janelas, agenda.bloqueios, AGORA));
  assert.equal(horarioNaAgenda("2026-10-22T17:30:00Z", agenda.janelas, agenda.bloqueios, AGORA), false);
  assert.equal(horarioNaAgenda("2026-10-22T22:00:00Z", agenda.janelas, agenda.bloqueios, AGORA), false);
  assert.equal(horarioNaAgenda("2026-10-20T13:00:00Z", [], [], AGORA), false, "no passado, nunca");
  const base = { descricao: "Limpeza pós-mudança, 2 quartos", categoria: "limpeza", horarios: ["2026-10-22T13:00:00Z"] };
  assert.equal(validarPedido(base, agenda, AGORA).ok, true);
  assert.equal(validarPedido({ ...base, horarios: ["a", "b", "c", "d"] }, { janelas: [], bloqueios: [] }, AGORA).ok, false);
  assert.equal(validarPedido({ ...base, descricao: "x".repeat(1001) }, agenda, AGORA).ok, false);
  const foto = { ...base, categoria: "fotografia", doCadastroDoImovel: true };
  assert.equal(validarPedido(foto, agenda, AGORA).ok, false, "fotógrafo do cadastro exige o imóvel");
  assert.equal(validarPedido({ ...foto, propertyId: "p1" }, agenda, AGORA).ok, true);
});

test("privacidade: antes do aceite, só bairro, tamanho e primeiro nome; depois, endereço e nome completo", () => {
  const imovel = { bairro: "Santa Mônica", cidade: "Uberlândia", areaM2: 70, quartos: 2, endereco: "Rua das Flores, 10" };
  const antes = visaoDoParceiro("orcado", imovel, { nomeCompleto: "Paulo Henrique Souza" });
  assert.equal(antes.nome, "Paulo");
  assert.equal(antes.imovel?.endereco, null);
  assert.equal(antes.imovel?.bairro, "Santa Mônica");
  const depois = visaoDoParceiro("aceito", imovel, { nomeCompleto: "Paulo Henrique Souza" });
  assert.equal(depois.nome, "Paulo Henrique Souza");
  assert.equal(depois.imovel?.endereco, "Rua das Flores, 10");
});

test("pagamento: só simulado, só para teste com a chave desligada; nunca 'pago' por aqui", async () => {
  assert.equal(podeSimularPagamento({ chaveLigada: false, contaTeste: true, status: "aceito", pagamentoStatus: "indisponivel" }), true);
  assert.equal(podeSimularPagamento({ chaveLigada: false, contaTeste: false, status: "aceito", pagamentoStatus: "indisponivel" }), false);
  assert.equal(podeSimularPagamento({ chaveLigada: true, contaTeste: true, status: "aceito", pagamentoStatus: "indisponivel" }), false);
  assert.equal(podeSimularPagamento({ chaveLigada: false, contaTeste: true, status: "aceito", pagamentoStatus: "simulado" }), false);
  const r = await provedorSimulado.pagar({ pedidoId: "abcdef12-0000", valores: congelarValores(100) });
  assert.equal(r.status, "simulado");
});

test("lembrete de 24 h cai em exatamente uma rodada diária; aviso de conclusão só depois de 7 dias", () => {
  const horario = "2026-10-22T20:00:00Z";
  const rodadas = Array.from({ length: 5 }, (_, d) => new Date(Date.parse("2026-10-19T13:00:00Z") + d * 86_400_000));
  assert.equal(rodadas.filter((r) => precisaLembrete24h("agendado", horario, r)).length, 1);
  assert.equal(precisaLembrete24h("aceito", horario, rodadas[2]), false);
  assert.equal(precisaAvisoConclusao("entregue", "2026-10-14T12:00:00Z", AGORA), true);
  assert.equal(precisaAvisoConclusao("entregue", "2026-10-16T12:00:00Z", AGORA), false);
});
