/*
  Prompt 55, parte B2 — datas flexíveis na busca: com e sem flexibilidade, contagem = lista, alerta e busca salva.
  Roda: node --experimental-strip-types --test src/lib/busca/datas-flexiveis.test.ts
*/
import assert from "node:assert/strict";
import { test } from "node:test";
import { FOLGA_DATAS_FLEXIVEIS_DIAS, ROTULO_DATAS_FLEXIVEIS, limiteDisponivel, passaEntrada, somarDias } from "./datas-flexiveis.ts";
import { FILTROS_PAINEL_VAZIOS, contarFiltrosPainel, passaNoPainel, resumoFiltros, type FiltrosPainel } from "./painel-filtros.ts";
import { imovelBateComBusca, type ImovelParaAlerta } from "./alerta-busca.ts";
import { normalizarBusca, resumoDaBusca } from "./buscas-salvas.ts";

const base = { monthlyPrice: 2000, bedrooms: 1, tagHomeOffice: false };
const imoveis = [
  { id: "ja", ...base, availableFrom: "2026-11-01" },
  { id: "no-dia", ...base, availableFrom: "2026-11-10" },
  { id: "5-depois", ...base, availableFrom: "2026-11-15" },
  { id: "15-depois", ...base, availableFrom: "2026-11-25" },
  { id: "16-depois", ...base, availableFrom: "2026-11-26" },
  { id: "sem-data", ...base, availableFrom: null },
];
const ENTRADA = "2026-11-10";
const lista = (f: FiltrosPainel) => imoveis.filter((p) => passaNoPainel(p, f)).map((p) => p.id);

test("folga: 15 dias (a mesma do 'quase' do Pedido de Moradia)", () => {
  assert.equal(FOLGA_DATAS_FLEXIVEIS_DIAS, 15);
  assert.equal(ROTULO_DATAS_FLEXIVEIS, "Datas flexíveis (até 15 dias depois)");
  assert.equal(somarDias("2026-12-25", 15), "2027-01-09");
  assert.equal(limiteDisponivel(ENTRADA, false), ENTRADA);
  assert.equal(limiteDisponivel(ENTRADA, true), "2026-11-25");
});

test("sem flexibilidade: só quem está disponível até a entrada (como antes)", () => {
  assert.deepEqual(lista({ ...FILTROS_PAINEL_VAZIOS, entrada: ENTRADA }), ["ja", "no-dia", "sem-data"]);
});

test("com flexibilidade: entra quem fica disponível até 15 dias depois; 16 dias não", () => {
  assert.deepEqual(lista({ ...FILTROS_PAINEL_VAZIOS, entrada: ENTRADA, datasFlexiveis: true }), ["ja", "no-dia", "5-depois", "15-depois", "sem-data"]);
});

test("sem data de entrada, a flexibilidade não muda nada", () => {
  assert.equal(lista({ ...FILTROS_PAINEL_VAZIOS, datasFlexiveis: true }).length, imoveis.length);
  assert.equal(lista(FILTROS_PAINEL_VAZIOS).length, imoveis.length);
  assert.equal(contarFiltrosPainel({ ...FILTROS_PAINEL_VAZIOS, datasFlexiveis: true }), 0);
  assert.ok(passaEntrada("2030-01-01", "", true));
});

test("contagem 'Mostrar N imóveis' = lista (mesma função), com e sem flexibilidade", () => {
  for (const datasFlexiveis of [false, true]) {
    const f = { ...FILTROS_PAINEL_VAZIOS, entrada: ENTRADA, datasFlexiveis };
    const contar = (g: FiltrosPainel) => imoveis.filter((p) => passaNoPainel(p, g)).length;
    assert.equal(contar(f), lista(f).length);
  }
  // A data em si conta fora da folha (chip "Entrada …"); a flexibilidade conta 1.
  assert.equal(contarFiltrosPainel({ ...FILTROS_PAINEL_VAZIOS, entrada: ENTRADA }), 0);
  assert.equal(contarFiltrosPainel({ ...FILTROS_PAINEL_VAZIOS, entrada: ENTRADA, datasFlexiveis: true }), 1);
  assert.match(resumoFiltros({ ...FILTROS_PAINEL_VAZIOS, entrada: ENTRADA, datasFlexiveis: true }), /Datas flexíveis/);
});

test("integra com a internet medida (57 fase 2): as duas regras valem juntas", () => {
  const medida = { downloadMbps: 200, validoAte: "2099-01-01T00:00:00Z" };
  const f = { ...FILTROS_PAINEL_VAZIOS, entrada: ENTRADA, datasFlexiveis: true, internetMin: 100 };
  assert.ok(passaNoPainel({ ...base, availableFrom: "2026-11-20", internetMedida: medida }, f));
  assert.ok(!passaNoPainel({ ...base, availableFrom: "2026-11-30", internetMedida: medida }, f));
  assert.ok(!passaNoPainel({ ...base, availableFrom: "2026-11-20" }, f));
});

test("alerta de busca e busca salva aceitam a flexibilidade", () => {
  const im: ImovelParaAlerta = {
    id: "a", title: "Apto", city: "Uberlândia", neighborhood: "Centro", propertyType: "Apartamento",
    monthlyPrice: 2000, bedrooms: 1, minPeriodDays: 30, tagHomeOffice: false, availableFrom: "2026-11-20",
  };
  assert.ok(!imovelBateComBusca(`local=Uberlândia&entrada=${ENTRADA}`, im));
  assert.ok(imovelBateComBusca(`local=Uberlândia&entrada=${ENTRADA}&flex=1`, im));
  assert.ok(!imovelBateComBusca(`local=Uberlândia&entrada=${ENTRADA}&flex=1`, { ...im, availableFrom: "2026-11-26" }));
  assert.match(normalizarBusca(`entrada=${ENTRADA}&flex=1`), /flex=1/);
  assert.match(resumoDaBusca(`local=Uberlândia&entrada=${ENTRADA}&flex=1`), /entrada 10\/11 · datas flexíveis/);
  assert.doesNotMatch(resumoDaBusca("local=Uberlândia&flex=1"), /flexíveis/);
});

import { passaBloqueios } from "./datas-flexiveis.ts";

test("53: datas bloqueadas (manuais ou importadas) tiram o imóvel da busca nessa entrada", () => {
  const bloqueios = [{ inicio: "2026-12-01", fim: "2026-12-04" }];
  assert.equal(passaBloqueios(bloqueios, "2026-11-20", false), false, "estadia de 30 dias a partir de 20/11 cruza 01–04/12");
  assert.equal(passaBloqueios(bloqueios, "2026-12-05", false), true);
  assert.equal(passaBloqueios(bloqueios, "", false), true, "sem data de entrada não tira ninguém");
  assert.equal(passaBloqueios([], "2026-11-20", false), true);
  // Datas flexíveis (55-B2): passa se alguma entrada até 15 dias depois couber.
  assert.equal(passaBloqueios(bloqueios, "2026-11-25", true), true, "entrando em 05/12 cabe");
  assert.equal(passaBloqueios([{ inicio: "2026-11-01", fim: "2027-03-01" }], "2026-11-25", true), false);
  // A faixa de estadia maior pesa: 5–6 meses (150 dias) a partir de 01/09 cruza dezembro.
  assert.equal(passaBloqueios(bloqueios, "2026-09-01", false, 150), false);
  assert.equal(passaBloqueios(bloqueios, "2026-09-01", false, 60), true);
});
