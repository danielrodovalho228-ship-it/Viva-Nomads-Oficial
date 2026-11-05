/*
  E522 — chips de "Mais filtros" que pareciam inertes: Estadia (1–2 / 3–4 / 5–6 meses) com a mesma contagem e
  "Contrato › Caução" idem. Investigação (05/11): os chips FILTRAM — passam por passaNoPainel, a mesma regra da lista
  e da contagem "Mostrar N". As contagens saem iguais porque o catálogo visível hoje não diferencia: os 15 anúncios de
  exemplo (o que o visitante vê, já que os 11 ativos de produção são de contas de teste) aceitam estadia de 30 dias sem
  teto e todos aceitam caução. Este teste prende a regra com um catálogo que diferencia, e documenta o catálogo atual.
  Roda: node --test src/lib/busca/e522-chips-estadia-caucao.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { FILTROS_PAINEL_VAZIOS, OPCOES_ESTADIA, passaNoPainel } from "./painel-filtros.ts";
import { SAMPLE_PROPERTIES } from "../properties.ts";

type Imovel = Parameters<typeof passaNoPainel>[0];
const base = { monthlyPrice: 3000, bedrooms: 1, tagHomeOffice: false } as unknown as Imovel;
const im = (o: Partial<Imovel> & { id: string }) => ({ ...base, ...o }) as Imovel & { id: string };
const CATALOGO = [
  im({ id: "curto", minPeriodDays: 30, maxPeriodDays: 60, garantiasAceitas: ["caucao_avista"] }),
  im({ id: "medio", minPeriodDays: 90, maxPeriodDays: 120, garantiasAceitas: ["seguro_fianca"] }),
  im({ id: "longo", minPeriodDays: 150, maxPeriodDays: 180, garantiasAceitas: ["caucao_parcelada", "seguro_fianca"] }),
];
const contar = (lista: readonly Imovel[], f: Partial<typeof FILTROS_PAINEL_VAZIOS>) => lista.filter((p) => passaNoPainel(p, { ...FILTROS_PAINEL_VAZIOS, ...f })).length;
const ids = (f: Partial<typeof FILTROS_PAINEL_VAZIOS>) => CATALOGO.filter((p) => passaNoPainel(p, { ...FILTROS_PAINEL_VAZIOS, ...f })).map((p) => p.id);

test("Estadia: cada faixa deixa passar só os anúncios em que ela cabe (os chips filtram de verdade)", () => {
  assert.deepEqual(OPCOES_ESTADIA.map((o) => o.valor), [60, 120, 180]);
  assert.deepEqual(ids({ periodo: 60 }), ["curto"]);
  assert.deepEqual(ids({ periodo: 120 }), ["medio"]);
  assert.deepEqual(ids({ periodo: 180 }), ["longo"]);
  // Contagem da folha = lista (a mesma regra): faixas diferentes, números diferentes.
  assert.deepEqual(OPCOES_ESTADIA.map((o) => contar(CATALOGO, { periodo: o.valor })), [1, 1, 1]);
  assert.equal(contar(CATALOGO, {}), 3);
});

test("Contrato › Caução: só quem aceita alguma modalidade de caução; seguro-fiança é outro chip", () => {
  assert.deepEqual(ids({ garantia: "caucao" }), ["curto", "longo"]);
  assert.deepEqual(ids({ garantia: "seguro_fianca" }), ["medio", "longo"]);
});

test("catálogo atual de exemplos: todos cabem nas três faixas e todos aceitam caução — por isso as contagens iguais", () => {
  const n = SAMPLE_PROPERTIES.length;
  for (const o of OPCOES_ESTADIA) assert.equal(contar(SAMPLE_PROPERTIES, { periodo: o.valor }), n, o.rotulo);
  assert.equal(contar(SAMPLE_PROPERTIES, { garantia: "caucao" }), n);
});
