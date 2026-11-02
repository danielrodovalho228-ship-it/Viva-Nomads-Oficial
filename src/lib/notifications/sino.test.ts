/** E444 itens 3 e 4 — o sino e a faixa de crítico (tela) — `npm test`. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { ROTA_AVISOS, VER_TODAS, acaoDaFaixa, criticosPendentes, destinoDoAviso, filtrarAvisos, ordenarParaOSino, rotuloContagem, ULTIMOS_DO_SINO } from "./sino.ts";

type A = Parameters<typeof ordenarParaOSino>[0][number];
const av = (id: string, prioridade: A["prioridade"], criado: string, extra: Partial<A> = {}): A => ({
  id,
  evento: "x",
  prioridade,
  titulo: id,
  url: null,
  criado_em: criado,
  lido_em: null,
  resolvido_em: null,
  ...extra,
});

test("contagem: nada com 0; até 9; depois '9+'", () => {
  assert.equal(rotuloContagem(0), null);
  assert.equal(rotuloContagem(1), "1");
  assert.equal(rotuloContagem(9), "9");
  assert.equal(rotuloContagem(10), "9+");
  assert.equal(rotuloContagem(250), "9+");
});

test("painel do sino: os últimos 8, crítico → urgente → mais recente", () => {
  const lista = [
    av("n-novo", "normal", "2026-11-02T10:00:00Z"),
    av("u-velho", "urgente", "2026-11-01T10:00:00Z"),
    av("c-velho", "critico", "2026-10-30T10:00:00Z"),
    av("u-novo", "urgente", "2026-11-02T09:00:00Z"),
    av("c-novo", "critico", "2026-11-01T12:00:00Z"),
  ];
  assert.deepEqual(
    ordenarParaOSino(lista).map((a) => a.id),
    ["c-novo", "c-velho", "u-novo", "u-velho", "n-novo"]
  );
  assert.equal(ULTIMOS_DO_SINO, 8);
  const muitos = Array.from({ length: 20 }, (_, i) => av(`a${i}`, "normal", new Date(Date.UTC(2026, 10, 1, i)).toISOString()));
  assert.equal(ordenarParaOSino(muitos).length, 8);
  assert.equal(ordenarParaOSino(muitos)[0].id, "a19");
});

test("crítico já resolvido ou lido não fura a fila: volta para a ordem por data", () => {
  const lista = [
    av("c-resolvido", "critico", "2026-10-01T10:00:00Z", { resolvido_em: "2026-10-02T10:00:00Z" }),
    av("c-lido", "critico", "2026-10-01T11:00:00Z", { lido_em: "2026-10-02T10:00:00Z" }),
    av("n", "normal", "2026-11-02T10:00:00Z"),
  ];
  assert.deepEqual(ordenarParaOSino(lista).map((a) => a.id), ["n", "c-lido", "c-resolvido"]);
});

test("filtro por prioridade da página de Notificações", () => {
  const lista = [av("c", "critico", "2026-11-01T00:00:00Z"), av("u", "urgente", "2026-11-01T00:00:00Z"), av("n", "normal", "2026-11-01T00:00:00Z")];
  assert.deepEqual(filtrarAvisos(lista, "todos").map((a) => a.id), ["c", "u", "n"]);
  assert.deepEqual(filtrarAvisos(lista, "critico").map((a) => a.id), ["c"]);
  assert.deepEqual(filtrarAvisos(lista, "urgente").map((a) => a.id), ["u"]);
  assert.deepEqual(filtrarAvisos(lista, "normal").map((a) => a.id), ["n"]);
});

test("destino: só caminho interno; sem destino → a lista completa", () => {
  assert.equal(destinoDoAviso("/dashboard/propostas/1"), "/dashboard/propostas/1");
  assert.equal(destinoDoAviso(null), VER_TODAS);
  assert.equal(destinoDoAviso("https://fora.com"), VER_TODAS);
  assert.equal(destinoDoAviso("//fora.com"), VER_TODAS);
  assert.equal(VER_TODAS, "/dashboard/notificacoes#avisos");
  assert.equal(ROTA_AVISOS, "/api/painel/avisos");
});

test("faixa: só crítico NÃO resolvido (lido ou não), o mais recente primeiro", () => {
  const lista = [
    av("c1", "critico", "2026-11-01T00:00:00Z", { lido_em: "2026-11-01T01:00:00Z" }),
    av("c2", "critico", "2026-11-02T00:00:00Z"),
    av("c3", "critico", "2026-11-03T00:00:00Z", { resolvido_em: "2026-11-03T01:00:00Z" }),
    av("u", "urgente", "2026-11-04T00:00:00Z"),
  ];
  assert.deepEqual(criticosPendentes(lista).map((a) => a.id), ["c2", "c1"]);
});

test("botão da faixa: a ação do evento", () => {
  assert.equal(acaoDaFaixa("contract_status"), "Assinar o contrato");
  assert.equal(acaoDaFaixa("proposta_recebida"), "Responder a proposta");
  assert.equal(acaoDaFaixa("proposta_vencendo"), "Responder a proposta");
  assert.equal(acaoDaFaixa("visita_pedida"), "Confirmar a visita");
  assert.equal(acaoDaFaixa("documento_recusado"), "Resolver agora");
});
