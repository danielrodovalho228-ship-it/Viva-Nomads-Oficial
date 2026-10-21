import { test } from "node:test";
import assert from "node:assert/strict";
import { atalhosComContagem, contarAtalho } from "./atalhos-contagem.ts";
import { OPCOES_PRECO } from "./painel-filtros.ts";
import { ATALHOS_CATEGORIA } from "../../config/atalhos-home.ts";

const base = { tagHomeOffice: false, petsAllowed: false, neighborhood: "Centro", city: "Uberlândia" };
const imoveis = [
  { ...base, monthlyPrice: 2000, bedrooms: 1, petsAllowed: true },
  { ...base, monthlyPrice: 2400, bedrooms: 2, tagHomeOffice: true, neighborhood: "Umuarama" },
  { ...base, monthlyPrice: 4000, bedrooms: 3, petsAllowed: true },
];

test("#a875278a: contagem de cada atalho segue as regras da /buscar", () => {
  assert.equal(contarAtalho("/buscar?pet=1", imoveis), 2);
  assert.equal(contarAtalho("/buscar?preco=2500", imoveis), 2);
  assert.equal(contarAtalho("/buscar?quartos=3", imoveis), 1);
  assert.equal(contarAtalho("/buscar?homeoffice=1", imoveis), 1);
  assert.equal(contarAtalho("/buscar?local=Umuarama", imoveis), 1);
});

test("#a875278a: atalho com 0 imóveis some e os demais trazem o total real", () => {
  const poucos = [{ ...base, monthlyPrice: 2000, bedrooms: 1 }];
  const vis = atalhosComContagem(ATALHOS_CATEGORIA, poucos);
  assert.deepEqual(vis.map((a) => a.rotulo), ["Até R$ 2.500/mês"]);
  assert.equal(vis[0].total, 1);
  assert.deepEqual(atalhosComContagem(ATALHOS_CATEGORIA, []), []);
});

test("#de7b27fd: 6ª caixa da home (Garagem) usa o filtro real da /buscar e conta de verdade", () => {
  const garagem = ATALHOS_CATEGORIA.find((a) => a.rotulo === "Com garagem");
  assert.ok(garagem, "atalho Com garagem existe");
  assert.equal(garagem.href, "/buscar?comod=garagem");
  assert.equal(ATALHOS_CATEGORIA.length % 2, 0, "grade com número par de caixas");
  const lista = [
    { ...base, monthlyPrice: 2000, bedrooms: 1, parkingSpots: 1 },
    { ...base, monthlyPrice: 2000, bedrooms: 1, comodidadesFiltro: ["garagem"] },
    { ...base, monthlyPrice: 2000, bedrooms: 1 },
  ];
  assert.equal(contarAtalho(garagem.href, lista), 2);
  assert.equal(contarAtalho(garagem.href, [{ ...base, monthlyPrice: 2000, bedrooms: 1 }]), 0);
});

test("#544b148a D15: atalho de preço usa ?preco com as faixas do filtro e conta pelo TOTAL", () => {
  const atalho = ATALHOS_CATEGORIA.find((a) => a.icone === "Wallet");
  assert.ok(atalho);
  const href = new URL(atalho.href, "https://x");
  assert.equal(href.pathname, "/buscar");
  assert.equal(href.searchParams.get("orcamento"), null);
  const faixa = Number(href.searchParams.get("preco"));
  assert.ok(OPCOES_PRECO.some((o) => o.valor === faixa), "faixa existe no filtro de preço");
  assert.equal(atalho.rotulo, `Até R$ ${faixa.toLocaleString("pt-BR")}/mês`);
  // Mensal 2.400, mas o total do cartão (3.020) passa de 2.500: não conta.
  const lista = [{ ...base, monthlyPrice: 2400, totalMes: 3020, bedrooms: 1 }, { ...base, monthlyPrice: 2000, totalMes: 2300, bedrooms: 1 }];
  assert.equal(contarAtalho(atalho.href, lista), 1);
  assert.equal(atalhosComContagem(ATALHOS_CATEGORIA, [lista[0]]).some((a) => a === atalho || a.href === atalho.href), false);
});

test("#978 (t162): a home conta como a /buscar — com imóvel real no resultado, os exemplos saem", () => {
  const ex = (id: string) => id.startsWith("ube-");
  const lista = [
    { ...base, id: "ube-001", monthlyPrice: 2200, bedrooms: 1 },
    { ...base, id: "real-1", monthlyPrice: 2100, bedrooms: 1 },
    { ...base, id: "real-2", monthlyPrice: 2500, bedrooms: 1 },
    { ...base, id: "real-3", monthlyPrice: 3200, bedrooms: 1 },
  ];
  // Antes: 3 (contava o exemplo); a /buscar?preco=2500 mostra 2 (só os reais).
  assert.equal(contarAtalho("/buscar?preco=2500", lista, (p) => ex(p.id)), 2);
  // Só exemplos no resultado: aparecem (como na /buscar).
  assert.equal(contarAtalho("/buscar?preco=2300", [lista[0], lista[3]], (p) => ex(p.id)), 1);
  // Capacidade conhecida abaixo de 1 morador não aparece na /buscar.
  assert.equal(contarAtalho("/buscar?preco=2500", [{ ...lista[1], maxGuests: 0 }]), 0);
  const vis = atalhosComContagem(ATALHOS_CATEGORIA, lista, (p) => ex(p.id));
  assert.equal(vis.find((a) => a.href.includes("preco=2500"))?.total, 2);
});
