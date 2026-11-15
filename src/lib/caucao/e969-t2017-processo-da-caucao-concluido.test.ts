/*
  t2017 (unitário) · E969 (Pista 3, lote 2, A4 com contrato — ORDEM-DUET-072 ponto 2) @E969 @E707 @ao-vivo-seguro
  Regra (coordenador, ORDEM-DUET-068 ponto 2): com contrato, a conversa só encerra depois do FIM DO PROCESSO DA CAUÇÃO —
  devolução concluída e contestação resolvida. Esta trava fixa, nas funções REAIS da caução, os dois fatos de que essa
  decisão depende:
    1. "processo concluído" = devolução feita e confirmada (integral ou com desconto aceito) e nenhuma contestação aberta;
       aguardando parecer, em contestação, em disputa, desconto contestado ou devolução ainda sem confirmação = NÃO concluído;
    2. a data: o teto externo da devolução é a saída + 30 dias corridos (o mesmo marco em estado e prazos).
  A decisão "encerra a conversa" ainda não existe no código: resíduo nomeado no E969 (e a perna de laboratório, até o
  lab ter contrato encerrável com caução devolvida). Quem a escrever consome estas funções.
  REGRA FINAL do coordenador (15/11, veta o piso de 30 dias): com contrato, a conversa encerra no que vier POR ÚLTIMO entre
  o fechamento do processo da caução e o fim da estadia + DIAS_PRAZO_AVALIACAO (14, src/lib/avaliacoes.ts — nunca um
  número à mão); sem caução, no fim da estadia + 14. Casos pedidos: caução fechada no dia 8 → aberta até o dia 14 e encerra
  no dia 14; fechada no dia 25 → encerra no dia 25. PONTO DE ADAPTAÇÃO: `encerraEm` abaixo é a regra escrita sobre as
  funções reais até existir a função da correção (Code 2); no PR dela, o teste passa a chamar a função real.
  Roda: node --test src/lib/caucao/e969-t2017-processo-da-caucao-concluido.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { estadoDosPrazos, PRAZO_DEVOLUCAO_DIAS, prazosDaSaida } from "./prazos.ts";
import { estadoCaucao } from "../caucao-estado.ts";
import { DIAS_PRAZO_AVALIACAO, prazoAvaliacao } from "../avaliacoes.ts";

const SAIDA = "2026-12-01";
const item = (status: string) => ({ valor: 500, categoria: "dano", comodo: "sala", fotoEntrada: "a", fotoSaida: "b", comprovante: "c", status }) as never;
const prazo = (o: Partial<Parameters<typeof estadoDosPrazos>[0]>) => estadoDosPrazos({ saida: SAIDA, parecerEm: null, descontos: [], devolvidaEm: null, hoje: SAIDA, caucao: 3000, ...o });
const caucao = (acerto: string | null) => estadoCaucao({ garantia: "caucao", blocos: [{ caucao: 3000, caucaoStatus: "comprovada" }], pagamentos: [], acerto: acerto ? { status: acerto } : null });

test("E969: o teto da devolução é a saída + 30 dias corridos", () => {
  assert.equal(PRAZO_DEVOLUCAO_DIAS, 30);
  assert.equal(prazosDaSaida(SAIDA).devolucaoAte, "2026-12-31");
  assert.equal(prazo({}).tetoExterno, "2026-12-31");
  assert.equal(prazo({}).devolverAte, "2026-12-31");
});

test("E969: devolução feita e confirmada encerra o processo (integral ou com desconto aceito)", () => {
  assert.equal(prazo({ parecerEm: "2026-12-05", devolvidaEm: "2026-12-20", hoje: "2027-01-02" }).chave, "devolvida");
  assert.equal(caucao("devolvida_integral").chave, "devolvida");
  assert.equal(caucao("desconto_confirmado").chave, "devolvida_com_desconto");
});

test("E969: sem devolução confirmada ou com contestação aberta, o processo NÃO terminou", () => {
  // Antes do parecer, na janela de contestação e em disputa: nada concluído.
  assert.equal(prazo({ hoje: "2026-12-03" }).chave, "aguardando_parecer");
  assert.equal(prazo({ parecerEm: "2026-12-05", descontos: [item("proposto")], hoje: "2026-12-07" }).chave, "em_contestacao");
  assert.equal(prazo({ parecerEm: "2026-12-05", descontos: [item("contestado")], hoje: "2027-01-10" }).chave, "em_disputa");
  // Passou do teto sem devolver: continua aberto (é pendência, não fim).
  const atrasada = prazo({ hoje: "2027-01-05" });
  assert.notEqual(atrasada.chave, "devolvida");
  assert.equal(atrasada.pendenciaDevolucao, true);
  // No estado da caução: devolução registrada sem confirmação e desconto contestado também não encerram.
  assert.equal(caucao("aguardando_confirmacao").chave, "devolucao_aguardando");
  assert.equal(caucao("desconto_contestado").chave, "desconto_contestado");
  assert.equal(caucao(null).chave, "recebida");
});

test("E969: a Viva nunca decide a disputa (o fim vem das partes)", () => {
  assert.equal(prazo({ parecerEm: "2026-12-05", descontos: [item("contestado")], hoje: "2027-02-01" }).vivaDecide, false);
});

/** Dia (AAAA-MM-DD) em que a conversa encerra: o último entre o fim do processo da caução e o fim da estadia + prazo da avaliação. */
function encerraEm(f: { saida: string; devolvidaEm: string | null; comCaucao: boolean; hoje: string }): string | null {
  const br = prazoAvaliacao(`${f.saida}T00:00:00Z`)!;
  const fimAvaliacao = `${br.slice(6, 10)}-${br.slice(3, 5)}-${br.slice(0, 2)}`;
  if (!f.comCaucao) return fimAvaliacao;
  const p = prazo({ saida: f.saida, parecerEm: f.devolvidaEm, devolvidaEm: f.devolvidaEm, hoje: f.hoje });
  if (p.chave !== "devolvida" || !f.devolvidaEm) return null; // processo aberto: não encerra
  return f.devolvidaEm > fimAvaliacao ? f.devolvidaEm : fimAvaliacao;
}
const dia = (n: number) => new Date(Date.parse(`${SAIDA}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);

test("E969 (regra final): o prazo da avaliação vem da constante — 14 dias depois do fim da estadia", () => {
  assert.equal(DIAS_PRAZO_AVALIACAO, 14);
  assert.equal(prazoAvaliacao(`${SAIDA}T00:00:00Z`), "15/12/2026");
});

test("E969 (regra final): caução fechada no dia 8 → a conversa segue aberta até o dia 14 e encerra no dia 14", () => {
  const quando = encerraEm({ saida: SAIDA, devolvidaEm: dia(8), comCaucao: true, hoje: dia(9) });
  assert.equal(quando, dia(14));
  assert.ok(dia(13) < quando!, "no dia 13 ainda está aberta");
});

test("E969 (regra final): caução fechada no dia 25 → encerra no dia 25", () => {
  assert.equal(encerraEm({ saida: SAIDA, devolvidaEm: dia(25), comCaucao: true, hoje: dia(26) }), dia(25));
});

test("E969 (regra final): sem caução, encerra no fim da estadia + 14; com o processo aberto, não encerra", () => {
  assert.equal(encerraEm({ saida: SAIDA, devolvidaEm: null, comCaucao: false, hoje: dia(1) }), dia(14));
  assert.equal(encerraEm({ saida: SAIDA, devolvidaEm: null, comCaucao: true, hoje: dia(40) }), null);
});
