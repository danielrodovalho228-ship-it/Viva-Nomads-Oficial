/*
  Prompt 62-B1 — regras puras da avaliação do imóvel (avaliadores credenciados).
  Roda: node --test src/lib/vistoria/regras.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  CODIGO_CONDUTA,
  FRACAO_AUDITORIA,
  avaliacaoVisivel,
  condicoesParaLigar,
  consequenciaAusencia,
  designacaoVencida,
  faltaParaCredenciamento,
  numeroCredenciado,
  notaConduta,
  pedidoPodeAbrir,
  podeReagendar,
  porteDoImovel,
  precoVigente,
  propoeDescredenciamento,
  proximoAvaliador,
  sorteadoParaAuditoria,
  suspendePorAusencias,
  tabelaCompleta,
  transicaoCredenciamento,
  validarConduta,
  valorNovaAvaliacao,
  visitaAmanha,
  type AvaliadorFila,
  type HistoricoDesignacao,
  type LinhaPreco,
  type PedidoParaDesignar,
} from "./regras.ts";

const AGORA = new Date("2026-10-23T12:00:00Z");
const dias = (n: number) => new Date(AGORA.getTime() - n * 86_400_000).toISOString();

function av(id: string, extra: Partial<AvaliadorFila> = {}): AvaliadorFila {
  return { id, userId: `u-${id}`, cidade: "Uberlândia", status: "ativo", teste: false, credenciadoEm: "2026-01-01T00:00:00Z", ultimaDesignacaoEm: null, relacoesDonos: [], relacoesImoveis: [], ...extra };
}
const PEDIDO: PedidoParaDesignar = { id: "p1", propertyId: "imovel-1", ownerId: "dono-1", cidade: "uberlandia", tipo: "inicial", teste: false, primeiroAvaliadorId: null, jaDesignados: [] };
const SEM_HIST: HistoricoDesignacao = { servicosAoDono: [], avaliacoesDoImovel: [] };

test("porte vem dos quartos do anúncio", () => {
  assert.equal(porteDoImovel(0), "estudio");
  assert.equal(porteDoImovel(null), "estudio");
  assert.equal(porteDoImovel(1), "q1_2");
  assert.equal(porteDoImovel(2), "q1_2");
  assert.equal(porteDoImovel(3), "q3_mais");
  assert.equal(porteDoImovel(6), "q3_mais");
});

test("preço por porte: a linha mais recente em vigor da cidade; tabela vazia bloqueia o pedido", () => {
  const tabela: LinhaPreco[] = [
    { cidade: "Uberlândia", porte: "q1_2", valor: 300, incluiTexto: null, vigenteDesde: "2026-09-01T00:00:00Z" },
    { cidade: "uberlandia", porte: "q1_2", valor: 350, incluiTexto: "Inclui deslocamento.", vigenteDesde: "2026-10-01T00:00:00Z" },
    { cidade: "Uberlândia", porte: "q1_2", valor: 999, incluiTexto: null, vigenteDesde: "2026-12-01T00:00:00Z" }, // futura
    { cidade: "Uberlândia", porte: "estudio", valor: 250, incluiTexto: null, vigenteDesde: "2026-09-01T00:00:00Z" },
  ];
  assert.equal(precoVigente(tabela, "Uberlândia", "q1_2", AGORA)?.valor, 350);
  assert.equal(precoVigente(tabela, "Uberlândia", "estudio", AGORA)?.valor, 250);
  assert.equal(precoVigente(tabela, "Uberlândia", "q3_mais", AGORA), null);
  assert.equal(precoVigente(tabela, "Araguari", "q1_2", AGORA), null);
  assert.equal(tabelaCompleta(tabela, "Uberlândia", AGORA), false);
  assert.deepEqual(pedidoPodeAbrir({ chaveAtiva: true, anuncioPublicado: true, preco: null }), { ok: false, motivo: "A avaliação ainda não tem valor nesta cidade." });
  assert.deepEqual(pedidoPodeAbrir({ chaveAtiva: true, anuncioPublicado: true, preco: tabela[1] }), { ok: true });
  assert.equal(pedidoPodeAbrir({ chaveAtiva: false, anuncioPublicado: true, preco: tabela[1] }).ok, false);
  assert.equal(pedidoPodeAbrir({ chaveAtiva: true, anuncioPublicado: false, preco: tabela[1] }).ok, false);
});

test("nova avaliação até 90 dias depois do reprovado: 50% da tabela vigente; depois, valor cheio", () => {
  assert.deepEqual(valorNovaAvaliacao(350, dias(10), AGORA), { valor: 175, comDesconto: true });
  assert.deepEqual(valorNovaAvaliacao(333.33, dias(90), AGORA), { valor: 166.67, comDesconto: true });
  assert.deepEqual(valorNovaAvaliacao(350, dias(91), AGORA), { valor: 350, comDesconto: false });
  assert.deepEqual(valorNovaAvaliacao(350, null, AGORA), { valor: 350, comDesconto: false });
});

test("chave: as 3 condições com o estado de cada uma", () => {
  const c = condicoesParaLigar({ tabelaCompleta: false, avaliadoresAtivos: 1, parecerItem14: false });
  assert.deepEqual(c.map((x) => [x.id, x.ok]), [["tabela", false], ["avaliadores", false], ["parecer", false]]);
  assert.equal(c[0].detalhe, "tabela sem valor");
  assert.ok(condicoesParaLigar({ tabelaCompleta: true, avaliadoresAtivos: 2, parecerItem14: true }).every((x) => x.ok));
});

test("chave desligada esconde tudo do dono e do morador; credenciamento e admin seguem", () => {
  assert.equal(avaliacaoVisivel("dono", false), false);
  assert.equal(avaliacaoVisivel("morador", false), false);
  assert.equal(avaliacaoVisivel("avaliador", false), true);
  assert.equal(avaliacaoVisivel("admin", false), true);
  assert.equal(avaliacaoVisivel("dono", true), true);
});

test("credenciamento: o que falta, número por cidade e em_teste → ativo só por admin AAL2", () => {
  assert.deepEqual(faltaParaCredenciamento({ identidadeVerificada: true, documentoValido: true, experienciaArquivo: false, experienciaLink: "https://meu.portfolio.com", aceiteConduta: true, cidade: "Uberlândia" }), []);
  const falta = faltaParaCredenciamento({ identidadeVerificada: false, documentoValido: false, experienciaArquivo: false, experienciaLink: "http://x", aceiteConduta: false, cidade: "" });
  assert.equal(falta.length, 5);
  assert.equal(numeroCredenciado("Uberlândia", 1), "UDI-001");
  assert.equal(numeroCredenciado("Uberlândia", 12), "UDI-012");
  assert.equal(numeroCredenciado("Ituiutaba", 3), "ITU-003");
  assert.deepEqual(transicaoCredenciamento("em_teste", "ativo"), { ok: true, exigeAdminAal2: true });
  assert.equal(transicaoCredenciamento("solicitado", "ativo").ok, false, "não pula a avaliação de teste");
  assert.equal(transicaoCredenciamento("descredenciado", "ativo").ok, false);
  assert.ok(CODIGO_CONDUTA.versao && CODIGO_CONDUTA.itens.length >= 4);
});

test("rodízio justo: há mais tempo sem designação primeiro; nunca designado antes de todos", () => {
  const fila = [av("a", { ultimaDesignacaoEm: dias(1) }), av("b", { ultimaDesignacaoEm: dias(10) }), av("c", { ultimaDesignacaoEm: dias(5) })];
  assert.equal(proximoAvaliador(fila, PEDIDO, SEM_HIST, AGORA).avaliador?.id, "b");
  assert.equal(proximoAvaliador([...fila, av("novo")], PEDIDO, SEM_HIST, AGORA).avaliador?.id, "novo");
  // Ciclo: designa, atualiza, o próximo é outro (cada um uma vez antes de repetir).
  let f = fila.map((x) => ({ ...x }));
  const ordem: string[] = [];
  for (let i = 0; i < 3; i++) {
    const r = proximoAvaliador(f, PEDIDO, SEM_HIST, new Date(AGORA.getTime() + i * 1000));
    ordem.push(r.avaliador!.id);
    f = f.map((x) => (x.id === r.avaliador!.id ? { ...x, ultimaDesignacaoEm: new Date(AGORA.getTime() + i * 1000).toISOString() } : x));
  }
  assert.deepEqual(ordem, ["b", "c", "a"]);
});

test("impedimentos: serviço ao dono em 12 meses, relação declarada, anterior do imóvel, suspenso, 1º da contestação", () => {
  const h: HistoricoDesignacao = {
    servicosAoDono: [
      { userId: "u-servico", ownerId: "dono-1", em: dias(200) },
      { userId: "u-antigo", ownerId: "dono-1", em: dias(400) },
    ],
    avaliacoesDoImovel: [
      { avaliadorId: "velho", em: dias(500) },
      { avaliadorId: "anterior", em: dias(100) },
    ],
  };
  const fila = [
    av("servico"),
    av("antigo", { ultimaDesignacaoEm: dias(1) }),
    av("relacao-dono", { relacoesDonos: ["dono-1"] }),
    av("relacao-imovel", { relacoesImoveis: ["imovel-1"] }),
    av("anterior"),
    av("velho", { ultimaDesignacaoEm: dias(2) }),
    av("suspenso", { status: "suspenso" }),
    av("outra", { cidade: "Araguari" }),
  ];
  const r = proximoAvaliador(fila, PEDIDO, h, AGORA);
  const motivo = Object.fromEntries(r.impedidos.map((i) => [i.id, i.motivo]));
  assert.equal(motivo.servico, "servico_12_meses");
  assert.equal(motivo["relacao-dono"], "relacao_declarada");
  assert.equal(motivo["relacao-imovel"], "relacao_declarada");
  assert.equal(motivo.anterior, "avaliacao_anterior");
  assert.equal(motivo.suspenso, "suspenso");
  assert.equal(motivo.outra, undefined, "outra cidade nem entra na fila desta cidade");
  // Serviço há mais de 12 meses e avaliação ANTES da anterior não impedem: entre os dois, o de mais tempo sem designação.
  assert.equal(r.avaliador?.id, "velho");
  // Contestação: quem fez a 1ª fica de fora.
  const c = proximoAvaliador([av("primeiro"), av("segundo", { ultimaDesignacaoEm: dias(1) })], { ...PEDIDO, tipo: "contestacao", primeiroAvaliadorId: "primeiro" }, SEM_HIST, AGORA);
  assert.equal(c.avaliador?.id, "segundo");
  assert.deepEqual(c.impedidos, [{ id: "primeiro", motivo: "primeira_da_contestacao" }]);
});

test("recusa ou silêncio de 24 h: passa ao próximo; sem ninguém elegível, o pedido aguarda e diz por quê", () => {
  assert.equal(designacaoVencida(new Date(AGORA.getTime() - 23 * 3_600_000).toISOString(), AGORA), false);
  assert.equal(designacaoVencida(new Date(AGORA.getTime() - 24 * 3_600_000).toISOString(), AGORA), true);
  const fila = [av("a"), av("b", { ultimaDesignacaoEm: dias(1) })];
  const primeiro = proximoAvaliador(fila, PEDIDO, SEM_HIST, AGORA);
  assert.equal(primeiro.avaliador?.id, "a");
  const segundo = proximoAvaliador(fila, { ...PEDIDO, jaDesignados: ["a"] }, SEM_HIST, AGORA);
  assert.equal(segundo.avaliador?.id, "b");
  const nenhum = proximoAvaliador(fila, { ...PEDIDO, jaDesignados: ["a", "b"] }, SEM_HIST, AGORA);
  assert.equal(nenhum.avaliador, null);
  assert.equal("motivo" in nenhum && nenhum.motivo, "nenhum_elegivel");
});

test("contas de teste: fora do rodízio real; a avaliação de teste vai ao avaliador em teste", () => {
  const fila = [av("teste", { teste: true }), av("emteste", { status: "em_teste" }), av("real", { ultimaDesignacaoEm: dias(1) })];
  assert.equal(proximoAvaliador(fila, PEDIDO, SEM_HIST, AGORA).avaliador?.id, "real");
  const t = proximoAvaliador([av("emteste", { status: "em_teste" }), av("solicitado", { status: "solicitado" })], { ...PEDIDO, teste: true }, SEM_HIST, AGORA);
  assert.equal(t.avaliador?.id, "emteste");
});

test("agenda: reagendar 1 vez por parte com 24 h; ausência do avaliador redesigna sem custo; 2 ausências em 90 dias suspendem", () => {
  const em = (h: number) => new Date(AGORA.getTime() + h * 3_600_000).toISOString();
  assert.deepEqual(podeReagendar(em(30), AGORA, false), { ok: true });
  assert.equal(podeReagendar(em(10), AGORA, false).ok, false);
  assert.equal(podeReagendar(em(30), AGORA, true).ok, false);
  assert.deepEqual(consequenciaAusencia("avaliador"), { novoPedidoPelaTabela: false, redesignarComPrioridade: true, custoAoDono: false });
  assert.equal(consequenciaAusencia("dono").novoPedidoPelaTabela, true);
  assert.equal(consequenciaAusencia("morador").custoAoDono, true);
  assert.equal(suspendePorAusencias([dias(10)], AGORA), false);
  assert.equal(suspendePorAusencias([dias(10), dias(80)], AGORA), true);
  assert.equal(suspendePorAusencias([dias(10), dias(100)], AGORA), false);
  assert.equal(visitaAmanha("2026-10-24T13:00:00Z", "2026-10-23"), true);
  assert.equal(visitaAmanha("2026-10-25T13:00:00Z", "2026-10-23"), false);
});

test("conduta: só itens de conduta, notas 1–5, texto sem resultado e sem contato; sem campo de resultado", () => {
  const semContato = () => false;
  const ok = validarConduta("dono", { pontualidade: 5, cordialidade: 4, cuidado: 5 }, "Chegou no horário e foi cuidadoso.", semContato);
  assert.deepEqual(ok, { ok: true, notas: { pontualidade: 5, cordialidade: 4, cuidado: 5 }, texto: "Chegou no horário e foi cuidadoso." });
  assert.equal(validarConduta("dono", { pontualidade: 5, cordialidade: 4, cuidado: 5, resultado: 1 }, null, semContato).ok, false);
  assert.equal(validarConduta("dono", { pontualidade: 6, cordialidade: 4, cuidado: 5 }, null, semContato).ok, false);
  for (const t of ["Me reprovou sem motivo", "O resultado foi injusto", "Deu nível Essencial", "aprovado!"]) {
    assert.equal(validarConduta("dono", { pontualidade: 3, cordialidade: 3, cuidado: 3 }, t, semContato).ok, false, t);
  }
  assert.equal(validarConduta("dono", { pontualidade: 3, cordialidade: 3, cuidado: 3 }, "liga 34 99999-0000", () => true).ok, false);
  assert.equal(validarConduta("avaliador", { imovel_pronto: 5, horario_respeitado: 4 }, null, semContato).ok, true);
  assert.equal(validarConduta("avaliador", { pontualidade: 5 }, null, semContato).ok, false);
  assert.equal(notaConduta([{ pontualidade: 5, cordialidade: 4, cuidado: 5 }, { pontualidade: 3, cordialidade: 3, cuidado: 4 }]), 4);
  assert.equal(notaConduta([]), null);
});

test("auditoria: sorteio estável na fração configurada; 2 'não confere' em 12 meses propõem descredenciamento", () => {
  const ids = Array.from({ length: 5000 }, (_, i) => `pedido-${i}-${(i * 7919) % 10007}`);
  const sorteados = ids.filter((id) => sorteadoParaAuditoria(id)).length / ids.length;
  assert.ok(Math.abs(sorteados - FRACAO_AUDITORIA) < 0.02, `fração ${sorteados}`);
  assert.equal(sorteadoParaAuditoria("x-1"), sorteadoParaAuditoria("x-1"));
  assert.equal(ids.filter((id) => sorteadoParaAuditoria(id, 0.5)).length > ids.filter((id) => sorteadoParaAuditoria(id, 0.1)).length, true);
  assert.equal(propoeDescredenciamento([{ resultado: "nao_confere", em: dias(30) }, { resultado: "confere", em: dias(20) }], AGORA), false);
  assert.equal(propoeDescredenciamento([{ resultado: "nao_confere", em: dias(30) }, { resultado: "nao_confere", em: dias(300) }], AGORA), true);
  assert.equal(propoeDescredenciamento([{ resultado: "nao_confere", em: dias(30) }, { resultado: "nao_confere", em: dias(400) }], AGORA), false);
});
