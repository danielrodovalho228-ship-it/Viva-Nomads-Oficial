import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { FORMULAS_CARTEIRA, indicadoresCarteira, montarCarteira, situacaoDoContrato, type ContratoCarteiraEntrada } from "./carteira-dono.ts";
import { periodoDosBlocos } from "./contrato-blocos.ts";

/*
  Complemento do prompt 27, item 8 — Análise da carteira ligada ao banco (reteste do Muse no #858, 18/10).
*/
const ler = (rel: string) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8");
const HOJE = "2026-10-19";

const imoveis = [
  { id: "p-ativo", titulo: "Santa Mônica", bairro: "Santa Mônica" },
  { id: "p-pagto", titulo: "[TESTE QA] Carteira 3", bairro: "Centro" },
  { id: "p-concl", titulo: "[TESTE QA] Carteira 1", bairro: "Centro" },
  { id: "p-canc", titulo: "Cancelado", bairro: "Tibery" },
  { id: "p-sem", titulo: "Sem contrato", bairro: "Brasil" },
];
const contratos: ContratoCarteiraEntrada[] = [
  { id: "d9c70197-0000-4000-8000-000000000001", propertyId: "p-ativo", status: "ativo", etapa: "em_vigencia", valorMensal: 3200, morador: "Iara J.", blocos: [{ inicio: "2026-09-01", fim: "2026-10-30" }, { inicio: "2026-10-31", fim: "2026-12-29" }] },
  { id: "a238bd01-0000-4000-8000-000000000002", propertyId: "p-pagto", status: "ativo", etapa: "aguardando_pagamento", valorMensal: 3600, morador: "Ivo C.", blocos: [{ inicio: "2026-09-29", fim: "2026-12-27" }] },
  { id: "c1000000-0000-4000-8000-000000000003", propertyId: "p-concl", status: "concluido", etapa: "em_vigencia", valorMensal: 2800, morador: "Ivo C.", blocos: [{ inicio: "2026-04-02", fim: "2026-06-30" }] },
  { id: "c2000000-0000-4000-8000-000000000004", propertyId: "p-canc", status: "cancelado", etapa: "aguardando_assinatura", valorMensal: 2500, morador: null, blocos: [] },
];

test("situação: ativo em vigência = ocupado; aguardando assinatura ou 1º pagamento = reservado; concluído/cancelado = vago", () => {
  assert.equal(situacaoDoContrato({ status: "ativo", etapa: "em_vigencia" }), "ocupado");
  assert.equal(situacaoDoContrato({ status: "ativo", etapa: "aguardando_pagamento" }), "reservado");
  assert.equal(situacaoDoContrato({ status: "ativo", etapa: "aguardando_assinatura" }), "reservado");
  assert.equal(situacaoDoContrato({ status: "concluido", etapa: "em_vigencia" }), "vago");
  assert.equal(situacaoDoContrato({ status: "cancelado", etapa: "aguardando_assinatura" }), "vago");
});

test("um item por imóvel ativo; início e fim pelos blocos; número do contrato = 8 primeiros caracteres", () => {
  const itens = montarCarteira(imoveis, contratos, HOJE);
  assert.equal(itens.length, 5);
  const ocupado = itens.find((i) => i.propertyId === "p-ativo")!;
  assert.equal(ocupado.situacao, "ocupado");
  assert.equal(ocupado.inicio, "2026-09-01");
  assert.equal(ocupado.fim, "2026-12-29", "o fim é o do ÚLTIMO bloco");
  assert.equal(ocupado.diasAteFim, 71);
  assert.equal(ocupado.contratoNumero, "d9c70197");
  assert.equal(ocupado.morador, "Iara J.");
  const reservado = itens.find((i) => i.propertyId === "p-pagto")!;
  assert.equal(reservado.situacao, "reservado");
  assert.equal(reservado.contratoNumero, "a238bd01");
  for (const id of ["p-concl", "p-canc", "p-sem"]) {
    const v = itens.find((i) => i.propertyId === id)!;
    assert.equal(v.situacao, "vago", id);
    assert.equal(v.valorMensal, 0);
    assert.equal(v.contratoId, null, "vago não mostra contrato encerrado");
  }
  // Mesma fonte de datas da página do contrato (Entrada / Saída).
  assert.deepEqual(periodoDosBlocos(contratos[0].blocos), { inicio: "2026-09-01", fim: "2026-12-29" });
  assert.match(ler("./data/contrato-assinar-actions.ts"), /const \{ inicio, fim \} = periodoDosBlocos\(/);
});

test("indicadores: ocupação = ocupados ÷ ativos; reservado à parte; receita em vigência e contratada a começar", () => {
  const m = indicadoresCarteira(montarCarteira(imoveis, contratos, HOJE));
  assert.equal(m.ativos, 5);
  assert.equal(m.ocupados, 1);
  assert.equal(m.reservados, 1);
  assert.equal(m.vagos, 3);
  assert.equal(m.ocupacaoPct, 20);
  assert.equal(m.receitaVigencia, 3200);
  assert.equal(m.contratadaAComecar, 3600);
  // Vencimentos: 69 e 71 dias → faixa de 61 a 90.
  assert.deepEqual(m.vence90.map((i) => i.propertyId), ["p-pagto", "p-ativo"]);
  assert.equal(m.vence30.length + m.vence60.length, 0);
});

test("massa do E2E (proprietario1): 4 ativos, 1 ocupado, 1 reservado, 2 vagos → 25%, R$ 3.200 e R$ 3.600", () => {
  const quatro = imoveis.filter((i) => ["p-ativo", "p-pagto", "p-concl", "p-sem"].includes(i.id));
  const m = indicadoresCarteira(montarCarteira(quatro, contratos, HOJE));
  assert.deepEqual([m.ativos, m.ocupados, m.reservados, m.vagos, m.ocupacaoPct], [4, 1, 1, 2, 25]);
  assert.equal(m.receitaVigencia, 3200);
  assert.equal(m.contratadaAComecar, 3600);
});

test("a taxa de serviço não entra na receita; fórmulas escritas na tela; sem 'aluguel'", () => {
  assert.match(FORMULAS_CARTEIRA.receita, /taxa de serviço não entra/);
  const cliente = ler("../app/(dashboard)/dashboard/carteira/carteira-client.tsx");
  assert.match(cliente, /FORMULAS_CARTEIRA/);
  assert.doesNotMatch(cliente, /aluguel/i);
  assert.doesNotMatch(cliente, /comiss/i);
});

test("guarda: a tela lê o banco; DEMO_PORTFOLIO só no modo demonstração; nenhum [] fixo como fonte", () => {
  const cliente = ler("../app/(dashboard)/dashboard/carteira/carteira-client.tsx");
  assert.match(cliente, /const fonte: ItemCarteira\[\] = demo \? DEMO_PORTFOLIO : itens;/);
  assert.equal((cliente.match(/DEMO_PORTFOLIO/g) ?? []).length, 2, "o import e o ramo do modo demo");
  assert.doesNotMatch(cliente, /\?\s*DEMO_PORTFOLIO\s*:\s*\[\]/);
  const pagina = ler("../app/(dashboard)/dashboard/carteira/page.tsx");
  assert.match(pagina, /await getCarteiraDoDono\(\)/);
  assert.match(pagina, /<CarteiraClient itens=\{itens\} \/>/);
  // Limpeza: o módulo de exemplo (SAMPLE_PORTFOLIO, "subleased") saiu.
  assert.equal(existsSync(fileURLToPath(new URL("./portfolio.ts", import.meta.url))), false);
  assert.doesNotMatch(cliente, /subleased|ownership/);
});
