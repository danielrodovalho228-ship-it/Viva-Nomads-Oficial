import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  chaveAutomacao,
  contarPorGatilho,
  emSilencio,
  horariosNaJanela,
  janelaDaLimpeza,
  momentoDaSugestao,
  pedidosDoEvento,
  semResposta,
  type ContratoDoEvento,
  type Vinculo,
} from "./pedidos-do-evento.ts";
import { conteudoFechamento, type EstadoParaFechar } from "../fiscal/fechamento.ts";

const C: ContratoDoEvento = { id: "ct1", propertyId: "im1", saida: "2026-11-20", checkoutBefore: "11:00" };
const v = (o: Partial<Vinculo>): Vinculo => ({ id: "v-" + (o.categoria ?? "limpeza"), categoria: "limpeza", parceiroId: "p1", servicoId: "s1", modo: "confirmar", status: "ativo", ...o });

test("saída em 5 dias: limpeza com a janela 'saída + 2 h até + 48 h'; confirmar espera o dono, automático vai direto", () => {
  const confirmar = pedidosDoEvento({ tipo: "saida_em_5_dias" }, [v({})], C);
  assert.equal(confirmar.length, 1);
  const a = confirmar[0];
  assert.ok(a.tipo === "criar");
  assert.equal(a.categoria, "limpeza");
  assert.equal(a.aguardandoDono, true);
  assert.equal(a.chave, "im1:limpeza:ct1:saida");
  assert.equal(a.janela!.inicio, "2026-11-20T16:00:00.000Z", "11:00 em Brasília + 2 h = 13:00 BRT");
  assert.equal(a.janela!.fim, "2026-11-22T14:00:00.000Z", "+ 48 h da saída");
  assert.match(a.descricao, /^Limpeza depois da saída do morador: entre 20\/11 às 13:00 e 22\/11 às 11:00\.$/);
  const auto = pedidosDoEvento({ tipo: "saida_em_5_dias" }, [v({ modo: "automatico" })], C);
  assert.ok(auto[0].tipo === "criar" && auto[0].aguardandoDono === false);
});

test("lavanderia vinculada vai junto com a limpeza; instruções do dono no texto", () => {
  const r = pedidosDoEvento({ tipo: "saida_em_5_dias" }, [v({ instrucoes: "trocar enxoval, 2 banheiros" }), v({ categoria: "lavanderia", modo: "automatico" })], C);
  assert.deepEqual(r.map((x) => (x.tipo === "criar" ? `${x.categoria}:${x.gatilho}` : x.tipo)), ["limpeza:saida_limpeza", "lavanderia:saida_lavanderia"]);
  assert.ok(r[0].tipo === "criar" && r[0].descricao.endsWith("Instruções do proprietário: trocar enxoval, 2 banheiros"));
});

test("próxima entrada antes do fim da janela: 'nova entrada em …: concluir até lá'", () => {
  const j = janelaDaLimpeza({ ...C, proximaEntrada: { data: "2026-11-21", checkinAfter: "14:00" } });
  assert.equal(j.fim, "2026-11-21T17:00:00.000Z");
  assert.equal(j.novaEntrada, j.fim);
  const r = pedidosDoEvento({ tipo: "saida_em_5_dias" }, [v({})], { ...C, proximaEntrada: { data: "2026-11-21", checkinAfter: "14:00" } });
  assert.ok(r[0].tipo === "criar" && r[0].descricao.includes("Nova entrada em 21/11 às 14:00: concluir até lá."));
  // Próxima entrada depois das 48 h não encurta.
  assert.equal(janelaDaLimpeza({ ...C, proximaEntrada: { data: "2026-12-01" } }).novaEntrada, null);
});

test("nada sem vínculo ativo: pendente, recusado e encerrado não disparam; o dono recebe o aviso da limpeza", () => {
  for (const status of ["pendente", "recusado", "encerrado"] as const) {
    const r = pedidosDoEvento({ tipo: "saida_em_5_dias" }, [v({ status })], C);
    assert.deepEqual(r, [{ tipo: "avisar_dono_sem_vinculo", categoria: "limpeza" }], status);
  }
  assert.deepEqual(pedidosDoEvento({ tipo: "conferencia_saida_fechada", itensReparo: [{ comodo: "Sala", descricao: "x", fotos: [] }] }, [], C), []);
});

test("manutenção só com item 'precisa de reparo', sempre confirmar, com itens e fotos", () => {
  const vinc = [v({ categoria: "manutencao", modo: "automatico" })];
  assert.deepEqual(pedidosDoEvento({ tipo: "conferencia_saida_fechada", itensReparo: [] }, vinc, C), []);
  const r = pedidosDoEvento(
    { tipo: "conferencia_saida_fechada", itensReparo: [{ comodo: "Banheiro", descricao: "Torneira pingando", fotos: ["a.jpg", "b.jpg"] }, { comodo: "Quarto", descricao: "Porta raspando", fotos: [] }] },
    vinc,
    C,
  );
  assert.equal(r.length, 1);
  assert.ok(r[0].tipo === "criar");
  assert.equal(r[0].aguardandoDono, true, "custo varia: sempre confirmar");
  assert.equal(r[0].chave, "im1:manutencao:ct1:reparo");
  assert.equal(r[0].descricao, "Reparos apontados na conferência de saída:\n- Banheiro: Torneira pingando (2 fotos)\n- Quarto: Porta raspando");
});

test("idempotência e remarcação: a remarcação ATUALIZA a mesma chave (não cria outro pedido)", () => {
  const criar = pedidosDoEvento({ tipo: "saida_em_5_dias" }, [v({})], C);
  const atualizar = pedidosDoEvento({ tipo: "estadia_remarcada" }, [v({})], { ...C, saida: "2026-12-05" });
  assert.equal(atualizar.length, 1);
  assert.ok(criar[0].tipo === "criar" && atualizar[0].tipo === "atualizar");
  assert.equal(atualizar[0].chave, criar[0].chave);
  assert.match(atualizar[0].descricao, /05\/12 às 13:00/);
  assert.equal(chaveAutomacao("im1", "limpeza", "ct1", "saida"), "im1:limpeza:ct1:saida");
});

test("encerramento cancela os automáticos não aceitos; morador só recebe sugestão", () => {
  assert.deepEqual(pedidosDoEvento({ tipo: "contrato_encerrado" }, [v({})], C), [{ tipo: "cancelar_automaticos", contratoId: "ct1" }]);
  const e = pedidosDoEvento({ tipo: "entrada_em_7_dias" }, [v({ modo: "automatico" })], C);
  assert.deepEqual(e, [{ tipo: "sugerir_morador", momento: "entrada", categorias: ["mudanca", "limpeza"] }]);
  const s = pedidosDoEvento({ tipo: "saida_em_7_dias" }, [v({ modo: "automatico" })], C);
  assert.deepEqual(s, [{ tipo: "sugerir_morador", momento: "saida", categorias: ["mudanca"] }]);
  assert.ok([...e, ...s].every((a) => a.tipo === "sugerir_morador"), "nunca pedido em nome do morador");
});

test("horários dentro da janela e da agenda; sem encaixe, o início marcado 'fora da agenda'", () => {
  const j = janelaDaLimpeza(C);
  const agora = new Date("2026-11-15T12:00:00Z");
  const livre = horariosNaJanela(j, { janelas: [], bloqueios: [] }, agora);
  assert.equal(livre.horarios.length, 3);
  assert.equal(livre.foraDaAgenda, false);
  assert.ok(livre.horarios.every((h) => h >= j.inicio && h < j.fim));
  // Agenda só aos domingos 08–12 (20/11/2026 é sexta): o domingo 22/11 de manhã cabe na janela.
  const domingo = horariosNaJanela(j, { janelas: [{ dia: 0, inicio: "08:00", fim: "12:00" }], bloqueios: [] }, agora);
  assert.ok(domingo.horarios.length >= 1 && !domingo.foraDaAgenda);
  const nunca = horariosNaJanela(j, { janelas: [{ dia: 3, inicio: "08:00", fim: "09:00" }], bloqueios: [] }, agora);
  assert.deepEqual(nunca, { horarios: [j.inicio], foraDaAgenda: true });
});

test("silêncio 22h–7h de Brasília e 'sem resposta em 24 h'", () => {
  assert.equal(emSilencio(new Date("2026-11-15T01:30:00Z")), true, "22:30 BRT");
  assert.equal(emSilencio(new Date("2026-11-15T09:59:00Z")), true, "06:59 BRT");
  assert.equal(emSilencio(new Date("2026-11-15T10:00:00Z")), false, "07:00 BRT");
  const agora = new Date("2026-11-16T12:00:00Z");
  assert.equal(semResposta("2026-11-15T11:59:00Z", "solicitado", agora), true);
  assert.equal(semResposta("2026-11-15T12:01:00Z", "solicitado", agora), false);
  assert.equal(semResposta("2026-11-10T12:00:00Z", "orcado", agora), false, "parceiro já respondeu");
});

test("conferência: 'precisa de reparo' entra no hash de fechamento só quando marcado", () => {
  const e: EstadoParaFechar = {
    conferenciaId: "c1",
    contrato: "VN-CT-1",
    tipo: "saida",
    itens: [{ parte: "proprietario", comodo: "Banheiro", descricao: "Torneira pingando", fotoPath: null, criadoEm: "2026-11-20T15:00:00Z" }],
    respostas: [],
    laudo: null,
    hashes: {},
  };
  const sem = conteudoFechamento(e, "janela_encerrada");
  assert.equal(conteudoFechamento({ ...e, itens: [{ ...e.itens[0], precisaReparo: false }] }, "janela_encerrada"), sem, "sem a marca: conteúdo igual ao de antes");
  const com = conteudoFechamento({ ...e, itens: [{ ...e.itens[0], precisaReparo: true }] }, "janela_encerrada");
  assert.notEqual(com, sem);
  assert.match(com, /Banheiro: Torneira pingando · precisa de reparo/);
});

test("GUARDAS do servidor: parceiro não vê o pedido que espera o dono; teto só para pedido manual; ganchos nos eventos", () => {
  const acoes = readFileSync(new URL("../parceiros/pedido-actions.ts", import.meta.url), "utf8");
  assert.match(acoes, /papel === "parceiro" && p\.aguardando_dono/);
  assert.match(acoes, /\.eq\("aguardando_dono", false\)/);
  assert.match(acoes, /\.eq\("origem", "manual"\)/);
  const estadia = readFileSync(new URL("../data/estadia-actions.ts", import.meta.url), "utf8");
  assert.match(estadia, /tipo: "estadia_remarcada"/);
  assert.match(estadia, /tipo: "contrato_encerrado"/);
  assert.match(readFileSync(new URL("../fiscal/conferencia-fechamento.ts", import.meta.url), "utf8"), /aoFecharConferencia\(admin, conferenciaId\)/);
  const srv = readFileSync(new URL("./servidor.ts", import.meta.url), "utf8");
  assert.doesNotMatch(srv, /pagamento_status|valor_combinado/, "o automático não mexe em valores nem pagamento");
  assert.match(srv, /semPush: emSilencio\(agora\)/);
});

test("cartão do morador: só nos 7 dias antes da entrada e da saída", () => {
  const p = { inicio: "2026-11-10", fim: "2027-02-10" };
  assert.equal(momentoDaSugestao(p, "2026-11-03"), "entrada");
  assert.equal(momentoDaSugestao(p, "2026-11-10"), "entrada");
  assert.equal(momentoDaSugestao(p, "2026-11-02"), null, "8 dias antes: ainda não");
  assert.equal(momentoDaSugestao(p, "2026-12-01"), null, "no meio da estadia: nada");
  assert.equal(momentoDaSugestao(p, "2027-02-04"), "saida");
  assert.equal(momentoDaSugestao(p, "2027-02-11"), null, "depois da saída: nada");
});

test("admin: contagem por gatilho sem contas de teste nem pedidos manuais", () => {
  const r = contarPorGatilho([
    { origem: "automatico", gatilho: "saida_limpeza", teste: false },
    { origem: "automatico", gatilho: "saida_limpeza", teste: true },
    { origem: "automatico", gatilho: "reparo_manutencao", teste: false },
    { origem: "manual", gatilho: null, teste: false },
  ]);
  assert.deepEqual(r, { saida_limpeza: 1, saida_lavanderia: 0, reparo_manutencao: 1 });
});

test("GUARDA: regra pura (sem banco, rede ou pagamento)", () => {
  const src = readFileSync(new URL("./pedidos-do-evento.ts", import.meta.url), "utf8");
  assert.doesNotMatch(src, /supabase|fetch\(|process\.env|pagamento_status|cobranca/);
});
