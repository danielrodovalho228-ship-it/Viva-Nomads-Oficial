/*
  Cadastro em 5 etapas (prompt 10): proximidades do OSM, negociação, sugestões.
  Roda: node --test src/lib/anuncio/cadastro-5-etapas.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  consultaNominatim,
  consultaOverpass,
  distanciaMetros,
  escolherProximidades,
  MAX_ITENS,
  paraProximity,
  tempoEstimado,
} from "../proximidades/osm.ts";
import {
  avisoAbaixoDoMinimo,
  descontoParaMeses,
  fraseDescontoCard,
  itensDisponiveis,
  normalizarLimites,
  normalizarNegociacao,
  valorComDesconto,
} from "./negociacao.ts";
import { capacidadeSugerida, consumoSugerido, contadorEssenciais, mbpsValido } from "./sugestoes-cadastro.ts";

const ORIGEM = { lat: -18.9186, lng: -48.2772 };
const perto = (dLat: number) => ({ lat: ORIGEM.lat + dLat, lon: ORIGEM.lng });

test("tempo: a pé até 1 km, de carro acima", () => {
  assert.equal(tempoEstimado(80), "1 min a pé");
  assert.equal(tempoEstimado(800), "10 min a pé");
  assert.equal(tempoEstimado(1000), "13 min a pé");
  assert.equal(tempoEstimado(2100), "5 min de carro");
});

test("distância haversine razoável (0,001° de latitude ≈ 111 m)", () => {
  const d = distanciaMetros(ORIGEM, { lat: ORIGEM.lat + 0.001, lng: ORIGEM.lng });
  assert.ok(d >= 108 && d <= 114, String(d));
});

test("consultas: Overpass com os 7 tipos num raio de 2 km; Nominatim sem complemento", () => {
  const q = consultaOverpass(ORIGEM.lat, ORIGEM.lng);
  for (const f of ["amenity\"=\"hospital", "shop\"=\"supermarket", "highway\"=\"bus_stop", "amenity\"=\"coworking_space"]) assert.ok(q.includes(f), f);
  assert.ok(q.includes("around:2000"));
  assert.equal(
    consultaNominatim({ rua: "Rua A", numero: "10", bairro: "Centro", cidade: "Uberlândia", uf: "MG", cep: "38400100" }),
    "Rua A, 10, Centro, Uberlândia, MG, 38400100, Brasil",
  );
});

test("escolhe até 8: o mais perto de cada tipo primeiro, sem nome fica de fora, fora do raio não entra", () => {
  const elementos = [
    { ...perto(0.003), tags: { amenity: "pharmacy", name: "Farmácia Longe" } },
    { ...perto(0.001), tags: { amenity: "pharmacy", name: "Farmácia Perto" } },
    { ...perto(0.002), tags: { shop: "supermarket", name: "Mercado A" } },
    { ...perto(0.004), tags: { shop: "supermarket", name: "Mercado B" } },
    { ...perto(0.005), tags: { shop: "supermarket", name: "Mercado C" } },
    { ...perto(0.0005), tags: { highway: "bus_stop" } },
    { center: { lat: ORIGEM.lat + 0.01, lon: ORIGEM.lng }, tags: { amenity: "hospital", name: "Hospital X" } },
    { ...perto(0.006), tags: { amenity: "university", name: "Universidade Y" } },
    { ...perto(0.007), tags: { leisure: "fitness_centre", name: "Academia Z" } },
    { ...perto(0.008), tags: { amenity: "coworking_space", name: "Cowork W" } },
    { ...perto(0.001), tags: { amenity: "hospital" } },
    { ...perto(0.05), tags: { amenity: "hospital", name: "Muito longe" } },
  ];
  const r = escolherProximidades({ elements: elementos }, ORIGEM);
  assert.equal(r.length, MAX_ITENS);
  assert.deepEqual(
    r.slice(0, 7).map((l) => l.nome),
    ["Hospital X", "Universidade Y", "Mercado A", "Farmácia Perto", "Academia Z", "Parada de ônibus", "Cowork W"],
  );
  assert.equal(r[7].nome, "Mercado B");
  assert.ok(!r.some((l) => l.nome === "Muito longe"));
  assert.deepEqual(paraProximity(r[3]), { category: "saude", name: "Farmácia Perto", note: "1 min a pé" });
  assert.deepEqual(escolherProximidades(null, ORIGEM), []);
});

test("negociação: normaliza, só itens liberados, faixas ordenadas e limitadas", () => {
  const n = normalizarNegociacao({
    aceita: true,
    itens: ["meses", "valor_mensal", "hackear", "meses", "caucao_parcelada"],
    descontos: [{ mesesMin: 6, pct: 6 }, { mesesMin: 3, pct: 3 }, { mesesMin: 3, pct: 5 }, { mesesMin: 1, pct: 2 }, { mesesMin: 7, pct: 50 }],
  }, false);
  assert.deepEqual(n.itens, ["meses", "valor_mensal"]);
  assert.deepEqual(n.descontos, [{ mesesMin: 3, pct: 3 }, { mesesMin: 6, pct: 6 }]);
  assert.deepEqual(normalizarNegociacao({ aceita: false, itens: ["meses"] }).itens, []);
  assert.deepEqual(normalizarNegociacao("lixo"), { aceita: false, itens: [], descontos: [] });
  assert.ok(!itensDisponiveis(false).some((i) => i.chave === "caucao_parcelada"));
  assert.ok(itensDisponiveis(true).some((i) => i.chave === "caucao_parcelada"));
});

test("caso G — estadia longa: R$ 3.200, 6 meses = 6% → R$ 3.008 × 6 = R$ 18.048", () => {
  const faixas = [{ mesesMin: 3, pct: 3 }, { mesesMin: 6, pct: 6 }];
  assert.equal(descontoParaMeses(faixas, 4), 3);
  assert.equal(descontoParaMeses(faixas, 6), 6);
  assert.equal(descontoParaMeses(faixas, 2), 0);
  const mensal = valorComDesconto(3200, descontoParaMeses(faixas, 6));
  assert.equal(mensal, 3008);
  assert.equal(mensal * 6, 18048);
  assert.equal(fraseDescontoCard(faixas), "6% de desconto a partir de 6 meses");
  assert.equal(fraseDescontoCard([]), null);
});

test("caso H — abaixo do mínimo: mínimo 2.950, proposta 2.800 → 'a partir de R$ 3.000', sem revelar 2.950", () => {
  assert.deepEqual(avisoAbaixoDoMinimo(2800, 2950), { tenteAPartirDe: 3000 });
  assert.equal(avisoAbaixoDoMinimo(3000, 2950), null);
  assert.deepEqual(avisoAbaixoDoMinimo(2800, 3000), { tenteAPartirDe: 3100 });
  assert.equal(avisoAbaixoDoMinimo(2800, null), null);
  assert.deepEqual(normalizarLimites({ valorMinimo: "2950", limpezasMax: 2 }), { valorMinimo: 2950, limpezasMax: 2 });
  assert.deepEqual(normalizarLimites({ valorMinimo: -1, limpezasMax: 99 }), { valorMinimo: null, limpezasMax: null });
});

test("sugestões: capacidade 2 por quarto, consumo por quartos, contador dos essenciais, Mbps", () => {
  assert.equal(capacidadeSugerida(0), 2);
  assert.equal(capacidadeSugerida(1), 2);
  assert.equal(capacidadeSugerida(3), 6);
  assert.equal(consumoSugerido(1), 150);
  assert.equal(consumoSugerido(2), 220);
  assert.equal(consumoSugerido(3), 290);
  assert.equal(consumoSugerido(null), 150);
  assert.equal(contadorEssenciais({ internet_fibra: true, mesa_trabalho: true, cadeira_ergonomica: true, ambiente_silencioso: true }), "3 de 4 itens essenciais");
  assert.equal(mbpsValido("500 Mbps"), 500);
  assert.equal(mbpsValido(""), null);
  assert.equal(mbpsValido("99999"), null);
});

test("preço sugerido da região: mediana de anúncios reais, bairro antes da cidade, nada sem 3 comparáveis", async () => {
  const { medianaSugerida, sugestaoDaRegiao } = await import("./sugestoes-cadastro.ts");
  assert.equal(medianaSugerida([3000, 3200]), null);
  assert.equal(medianaSugerida([3000, 3200, 3500]), 3200);
  assert.equal(medianaSugerida([3000, 3100, 3300, 3500]), 3200);
  assert.equal(medianaSugerida([2990, 3010, 3030]), 3000);
  assert.deepEqual(sugestaoDaRegiao([2800, 2900, 3100], [1, 2, 3, 4]), { valor: 2900, base: "bairro", n: 3 });
  assert.deepEqual(sugestaoDaRegiao([2800], [2500, 2600, 2700, 2800]), { valor: 2650, base: "cidade", n: 4 });
  assert.equal(sugestaoDaRegiao([], [2500]), null);
});
