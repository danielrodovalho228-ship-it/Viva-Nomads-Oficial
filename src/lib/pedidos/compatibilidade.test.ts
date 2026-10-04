/*
  Textos e agrupamentos da compatibilidade.
  Roda: node --test src/lib/pedidos/compatibilidade.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { melhorPor, porQueCombina, sugestaoAjuste, ordenarPares, type ParCompat } from "./compatibilidade.ts";

const base: ParCompat = {
  pedido_id: "p1",
  imovel_id: "a",
  dono_id: "d1",
  titulo: "A — Apto 2 quartos",
  situacao: "compativel",
  nota: 90,
  motivo: null,
  total_mensal: 3100,
  orcamento: 3000,
  vagas: 3,
  ocupantes: 2,
  prazo_dias: 120,
  min_dias: 30,
  max_dias: 180,
  entrada: "2026-11-01",
  disponivel_desde: "2026-10-15",
};

test("por que combina: total, vagas, prazo e data — o caso do teste real", () => {
  assert.deepEqual(porQueCombina(base), [
    "R$ 3.100/mês com condomínio e consumo, para um orçamento de R$ 3.000",
    "3 vagas para 2 pessoas",
    "aceita 120 dias (o anúncio aceita de 30 a 180)",
    "livre desde 15/10, antes da entrada em 01/11",
  ]);
});

test("melhor imóvel de cada dono: compatível vence quase; depois a maior nota", () => {
  const pares: ParCompat[] = [
    { ...base, imovel_id: "x", situacao: "quase", nota: 99 },
    { ...base, imovel_id: "y", situacao: "compativel", nota: 70 },
    { ...base, imovel_id: "z", situacao: "compativel", nota: 85 },
    { ...base, imovel_id: "b", dono_id: "d2", situacao: "demais", nota: 40 },
  ];
  const m = melhorPor(pares, "dono_id");
  assert.equal(m.get("d1")!.imovel_id, "z");
  assert.equal(m.get("d2")!.situacao, "demais");
  assert.deepEqual(ordenarPares(pares).map((p) => p.imovel_id), ["z", "y", "x", "b"]);
});

test("sugestão ao inquilino sem compatível: usa o 'quase' mais comum", () => {
  assert.equal(sugestaoAjuste([{ situacao: "demais", motivo: null }]), null);
  assert.match(
    sugestaoAjuste([
      { situacao: "quase", motivo: "R$ 250 acima do orçamento" },
      { situacao: "quase", motivo: "começa 10 dias depois" },
      { situacao: "quase", motivo: "R$ 400 acima do orçamento" },
    ])!,
    /3 imóveis quase combinam — aumentar um pouco o orçamento pode resolver \(R\$ 250 acima do orçamento\)/
  );
  assert.match(sugestaoAjuste([{ situacao: "quase", motivo: "começa 10 dias depois" }])!, /adiar a entrada/);
});
