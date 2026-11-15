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
  Roda: node --test src/lib/caucao/e969-t2017-processo-da-caucao-concluido.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { estadoDosPrazos, PRAZO_DEVOLUCAO_DIAS, prazosDaSaida } from "./prazos.ts";
import { estadoCaucao } from "../caucao-estado.ts";

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
