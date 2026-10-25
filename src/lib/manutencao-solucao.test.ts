/*
  Prompt 59, Parte B — prazo de solução da manutenção. Roda: node --test src/lib/manutencao-solucao.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { PRAZO_MANUTENCAO_H, PRAZO_SOLUCAO_H } from "../config/atendimento.ts";
import {
  CONFIRMACAO_MORADOR_H,
  avisoDevido,
  camposReabertura,
  compromissoManutencao,
  confirmacaoVencida,
  emSilencio,
  estadoSolucao,
  foraDoPrazo90d,
  moradorPodeResponder,
  reclassificar,
  seloPelaManutencao,
  solucaoAte,
  taxaSolucaoNoPrazo,
  type OrdemSolucao,
} from "./manutencao-solucao.ts";
import { selosDoAnuncio, notaQualidade, type SinaisAnuncio } from "./ranking/ordem.ts";

const ABERTA = "2026-10-20T12:00:00.000Z";
const H = 3_600_000;
const D = 86_400_000;
const em = (h: number) => new Date(Date.parse(ABERTA) + h * H);
const ordem = (o: Partial<OrdemSolucao>): OrdemSolucao => ({ priority: "media", openedAt: ABERTA, status: "aberto", ...o });

test("constante única: solução 24/72 h (urgente), 72 h (média), 168 h (baixa); 1ª resposta 4/24/72 h continua", () => {
  assert.deepEqual(PRAZO_SOLUCAO_H, { urgente: { provisoria: 24, definitiva: 72 }, media: 72, baixa: 168 });
  assert.deepEqual(PRAZO_MANUTENCAO_H, { urgente: 4, media: 24, baixa: 72 });
});

test("solucaoAte: as 3 prioridades (provisória e definitiva no urgente)", () => {
  assert.deepEqual(solucaoAte({ priority: "urgente", openedAt: ABERTA }), { provisoria: em(24), definitiva: em(72) });
  assert.deepEqual(solucaoAte({ priority: "media", openedAt: ABERTA }), { provisoria: null, definitiva: em(72) });
  assert.deepEqual(solucaoAte({ priority: "baixa", openedAt: ABERTA }), { provisoria: null, definitiva: em(168) });
});

test("estadoSolucao: no prazo, vencido, resolvido no prazo e fora, com a frase de Brasília", () => {
  const m = ordem({});
  assert.equal(estadoSolucao(m, em(71)).estado, "no_prazo");
  assert.equal(estadoSolucao(m, em(73)).estado, "vencido");
  assert.equal(estadoSolucao(ordem({ status: "resolvido", solucaoMarcadaEm: em(70).toISOString() }), em(200)).estado, "resolvido_no_prazo");
  assert.equal(estadoSolucao(ordem({ status: "resolvido", solucaoMarcadaEm: em(75).toISOString() }), em(200)).estado, "resolvido_fora");
  assert.equal(estadoSolucao(m, em(1)).texto, "resolver até 23/10/2026, 09:00 (horário de Brasília)");
  // Baixa: 7 dias.
  assert.equal(estadoSolucao(ordem({ priority: "baixa" }), em(167)).estado, "no_prazo");
  assert.equal(estadoSolucao(ordem({ priority: "baixa" }), em(169)).estado, "vencido");
  // Morador marcou Resolvida (fluxo que já existe): vale o resolved_at.
  assert.equal(estadoSolucao(ordem({ status: "resolvido", resolvedAt: em(10).toISOString() }), em(200)).estado, "resolvido_no_prazo");
});

test("urgente: provisória em 20 h e definitiva em 80 h → resolvido fora do prazo; provisória vencida já é 'vencido'", () => {
  const u = ordem({ priority: "urgente", provisoriaEm: em(20).toISOString(), status: "resolvido", solucaoMarcadaEm: em(80).toISOString() });
  const s = estadoSolucao(u, em(81));
  assert.equal(s.provisoria?.estado, "cumprida");
  assert.equal(s.estado, "resolvido_fora");
  assert.equal(estadoSolucao(ordem({ priority: "urgente", provisoriaEm: em(20).toISOString(), status: "resolvido", solucaoMarcadaEm: em(70).toISOString() }), em(81)).estado, "resolvido_no_prazo");
  assert.equal(estadoSolucao(ordem({ priority: "urgente" }), em(25)).estado, "vencido", "sem provisória em 24 h");
  assert.equal(estadoSolucao(ordem({ priority: "urgente", provisoriaEm: em(30).toISOString(), status: "resolvido", solucaoMarcadaEm: em(40).toISOString() }), em(50)).estado, "resolvido_fora", "provisória fora do prazo");
  assert.equal(estadoSolucao(ordem({ priority: "urgente", status: "resolvido", solucaoMarcadaEm: em(10).toISOString() }), em(50)).estado, "resolvido_no_prazo", "definitiva antes de 24 h vale como provisória");
});

test("morador confirma ou reabre em 48 h; sem resposta, fica resolvido na data do dono; reaberta não zera o prazo", () => {
  assert.equal(CONFIRMACAO_MORADOR_H, 48);
  const r = ordem({ status: "resolvido", solucaoMarcadaEm: em(50).toISOString() });
  assert.ok(moradorPodeResponder(r, em(97)));
  assert.ok(!moradorPodeResponder(r, em(98)));
  assert.ok(confirmacaoVencida(r, em(98)));
  assert.equal(estadoSolucao(r, em(98)).estado, "resolvido_no_prazo", "vale a data marcada pelo dono");
  // Reabre em 60 h: volta a correr o prazo ORIGINAL (72 h desde a abertura).
  const reab = { ...r, ...camposReabertura(em(60)) } as OrdemSolucao;
  assert.equal(reab.status, "em_andamento");
  assert.equal(reab.openedAt, ABERTA);
  assert.equal(estadoSolucao(reab, em(70)).estado, "no_prazo");
  assert.equal(estadoSolucao(reab, em(73)).estado, "vencido", "reaberta não ganhou prazo novo");
  const resolvidaDeNovo = { ...reab, status: "resolvido", solucaoMarcadaEm: em(80).toISOString() };
  assert.equal(estadoSolucao(resolvidaDeNovo, em(90)).estado, "resolvido_fora");
});

test("reclassificação: só o atendimento da Viva (admin AAL2), com motivo; prazos recalculados da abertura", () => {
  const o = { priority: "baixa" as const, prioridadeOriginal: null };
  const dono = reclassificar(o, "urgente", "vazamento grande", "proprietario", "u1", em(1));
  assert.deepEqual(dono, { ok: false, erro: "Só o atendimento da Viva muda a prioridade. Peça a reclassificação na ordem." });
  assert.equal(reclassificar(o, "urgente", "vazamento grande", "admin_sem_aal2", "u1", em(1)).ok, false);
  assert.equal(reclassificar(o, "urgente", "", "admin_aal2", "adm", em(1)).ok, false, "motivo obrigatório");
  const r = reclassificar(o, "urgente", "vazamento grande", "admin_aal2", "adm", em(1));
  assert.ok(r.ok);
  assert.deepEqual(r.ok && r.campos, { priority: "urgente", prioridade_original: "baixa", reclassificada_por: "adm", reclassificada_em: em(1).toISOString(), reclassificacao_motivo: "vazamento grande" });
  // Recalculado a partir da ABERTURA com a prioridade nova.
  assert.deepEqual(solucaoAte({ priority: "urgente", openedAt: ABERTA }).definitiva, em(72));
  // Segunda reclassificação mantém a prioridade original.
  const r2 = reclassificar({ priority: "urgente", prioridadeOriginal: "baixa" }, "media", "não era tão grave", "admin_aal2", "adm", em(2));
  assert.ok(r2.ok && r2.campos.prioridade_original === "baixa");
});

test("taxa de solução no prazo: resolvidos no prazo ÷ resolvidos em 12 meses; só existe com 3 ou mais", () => {
  const ok = (h: number) => ordem({ status: "resolvido", solucaoMarcadaEm: em(h).toISOString() });
  assert.equal(taxaSolucaoNoPrazo([ok(10), ok(80)], em(200)), null);
  assert.deepEqual(taxaSolucaoNoPrazo([ok(10), ok(80), ok(20), ordem({})], em(200)), { taxa: 2 / 3, noPrazo: 2, resolvidos: 3 });
  const velha = { ...ok(10), openedAt: new Date(Date.parse(ABERTA) - 400 * D).toISOString(), solucaoMarcadaEm: new Date(Date.parse(ABERTA) - 399 * D).toISOString() };
  assert.equal(taxaSolucaoNoPrazo([ok(10), ok(20), velha], em(200)), null, "fora dos 12 meses não conta");
});

test("selo: 3 soluções fora do prazo em 90 dias tiram 'Proprietário verificado'; aviso na 2ª; volta com menos de 3", () => {
  const fora = (diasAtras: number) => {
    const aberta = Date.parse(ABERTA) - diasAtras * D;
    return ordem({ openedAt: new Date(aberta).toISOString(), status: "resolvido", solucaoMarcadaEm: new Date(aberta + 80 * H).toISOString() });
  };
  const agora = em(0);
  assert.equal(foraDoPrazo90d([fora(10), fora(20), fora(30)], agora), 3);
  assert.equal(foraDoPrazo90d([fora(10), fora(20), fora(120)], agora), 2);
  assert.equal(seloPelaManutencao(1), "mantem");
  assert.equal(seloPelaManutencao(2), "aviso");
  assert.equal(seloPelaManutencao(3), "perde");
  const base = { identidadeConfirmada: true, matriculaConferida: true, conversas: 0, conversasRespondidas: 0, respostaMediaMin: null, fotosDeParceiro: false, precoJusto: false } as SinaisAnuncio;
  const tem = (n: number) => selosDoAnuncio({ ...base, manutencaoFora90d: n }).some((s) => s.codigo === "proprietario_verificado");
  assert.ok(tem(2));
  assert.ok(!tem(3));
  const cheio = { ...base, id: "a", donoId: "d", ehExemplo: false, ehTeste: false, fotosTotal: 1, comodosDistintos: 1, descricaoPalavras: 1, regrasCompletas: false, enderecoExato: false, calendarioConfirmadoEm: null, avaliacoesQtd: 0, avaliacoesMedia: null, cancelamentosDono12m: 0 } as SinaisAnuncio;
  assert.equal(notaQualidade({ ...cheio, manutencaoFora90d: 3 }, agora).nota, notaQualidade(cheio, agora).nota - 10);
});

test("avisos: 'antes do prazo' 2 h (urgente) / 12 h (média e baixa), vencido uma vez; silêncio 22h–7h, exceto urgente", () => {
  assert.equal(avisoDevido(ordem({}), em(59), []), null);
  assert.equal(avisoDevido(ordem({}), em(61), []), "antes_do_prazo");
  assert.equal(avisoDevido(ordem({}), em(61), ["antes_do_prazo"]), null);
  assert.equal(avisoDevido(ordem({}), em(73), ["antes_do_prazo"]), "vencido");
  assert.equal(avisoDevido(ordem({}), em(80), ["antes_do_prazo", "vencido"]), null);
  assert.equal(avisoDevido(ordem({ priority: "urgente" }), em(21), []), null);
  assert.equal(avisoDevido(ordem({ priority: "urgente" }), em(22.5), []), "antes_do_prazo", "2 h antes da provisória");
  assert.equal(avisoDevido(ordem({ status: "resolvido", solucaoMarcadaEm: em(5).toISOString() }), em(80), []), null);
  const noite = new Date("2026-10-23T02:00:00Z"); // 23h em Brasília
  const dia = new Date("2026-10-23T13:00:00Z"); // 10h
  assert.ok(emSilencio(noite, "media"));
  assert.ok(!emSilencio(noite, "urgente"));
  assert.ok(!emSilencio(dia, "baixa"));
});

test("compromissoManutencao: os 4 prazos para o anúncio, lidos das constantes", () => {
  const c = compromissoManutencao();
  assert.deepEqual(c.map((x) => x.texto), [
    "Urgente: solução provisória em até 24 h",
    "Urgente: solução definitiva em até 72 h",
    "Média: solução em até 72 h",
    "Baixa: solução em até 7 dias",
  ]);
  assert.deepEqual(c.map((x) => x.respostaH), [4, 4, 24, 72]);
});
