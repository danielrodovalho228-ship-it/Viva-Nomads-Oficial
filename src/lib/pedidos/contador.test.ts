/*
  Contador ao vivo do pedido de moradia.
  Roda: node --test src/lib/pedidos/contador.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { avaliarImovel, contarCompativeis, saidaDoPedido, type ImovelDaCidade, type RascunhoPedido } from "./contador.ts";

const pedido: RascunhoPedido = {
  dataInicio: "2026-11-01",
  prazoMeses: 4,
  ocupantes: 2,
  orcamento: 3000,
  pets: false,
  criancas: false,
};
const imovel: ImovelDaCidade = {
  total: 3100,
  minDias: 30,
  maxDias: 180,
  maxHospedes: 3,
  aceitaPets: false,
  aceitaCriancas: true,
  faixasAceitas: [],
  disponivelDesde: "2026-10-15",
  disponivelAte: null,
  ocupadoNoPeriodo: false,
};

test("saída do pedido: entrada + prazo×30 − 1 (mesma conta do banco)", () => {
  assert.equal(saidaDoPedido("2026-11-01", 4), "2027-02-28");
});

test("combina quando passa em todas as regras (preço até +10%)", () => {
  assert.equal(avaliarImovel(pedido, imovel).combina, true);
  assert.equal(avaliarImovel(pedido, { ...imovel, total: 3301 }).ok.orcamento, false);
});

test("regras do banco: vagas nulas, prazo fora, pet e criança, faixa, ocupado", () => {
  assert.equal(avaliarImovel(pedido, { ...imovel, maxHospedes: null }).ok.ocupantes, false);
  assert.equal(avaliarImovel(pedido, { ...imovel, maxDias: 90 }).ok.prazo, false);
  assert.equal(avaliarImovel({ ...pedido, pets: true }, imovel).ok.pet, false);
  assert.equal(avaliarImovel({ ...pedido, pets: true }, { ...imovel, aceitaPets: true }).ok.pet, true);
  assert.equal(avaliarImovel({ ...pedido, criancas: true }, { ...imovel, aceitaCriancas: false }).ok.criancas, false);
  assert.equal(avaliarImovel(pedido, { ...imovel, faixasAceitas: ["temporada"] }).ok.faixa, false);
  assert.equal(avaliarImovel(pedido, { ...imovel, faixasAceitas: ["media_estadia"] }).ok.faixa, true);
  assert.equal(avaliarImovel(pedido, { ...imovel, ocupadoNoPeriodo: true }).ok.entrada, false);
  assert.equal(avaliarImovel(pedido, { ...imovel, disponivelDesde: "2026-11-10" }).ok.entrada, false);
  assert.equal(avaliarImovel(pedido, { ...imovel, disponivelAte: "2026-10-31" }).ok.entrada, false);
});

test("conta os que combinam e não dá dica quando há resultado", () => {
  const r = contarCompativeis(pedido, [imovel, { ...imovel, total: 9000 }]);
  assert.deepEqual(r, { combinam: 1, naCidade: 2, dica: null });
});

test("zero na cidade: sem dica de filtro (a tela explica que ainda não há imóveis)", () => {
  assert.deepEqual(contarCompativeis(pedido, []), { combinam: 0, naCidade: 0, dica: null });
});

test("zero com dica: o campo que mais imóveis libera, com o valor concreto do orçamento", () => {
  const r = contarCompativeis({ ...pedido, orcamento: 2000 }, [
    { ...imovel, total: 3100 },
    { ...imovel, total: 3300 },
  ]);
  assert.equal(r.combinam, 0);
  assert.equal(r.dica, "Com orçamento de R$ 2.850 por mês, 2 imóveis combinariam.");
});

test("zero com dica de pet quando só o pet impede", () => {
  const r = contarCompativeis({ ...pedido, pets: true }, [imovel]);
  assert.equal(r.dica, "Sem pet, 1 imóvel combinaria.");
});

test("zero com dica de prazo mostra a faixa aceita pelos anúncios", () => {
  const r = contarCompativeis({ ...pedido, prazoMeses: 6 }, [{ ...imovel, maxDias: 120 }, { ...imovel, minDias: 60, maxDias: 150 }]);
  assert.equal(r.dica, "Só o prazo impede 2 imóveis de combinar — esses anúncios aceitam de 30 a 150 dias.");
});

test("sem dica quando nenhum campo sozinho resolve (duas regras falham em cada imóvel)", () => {
  const r = contarCompativeis({ ...pedido, orcamento: 1000, pets: true }, [imovel]);
  assert.equal(r.combinam, 0);
  assert.equal(r.dica, null);
});
