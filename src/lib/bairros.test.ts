/* Roda: node --test src/lib/bairros.test.ts */
import { test } from "node:test";
import assert from "node:assert/strict";
import { PONTOS_REFERENCIA } from "../config/pontos-referencia.ts";
import { caminhosDeBairros, agruparBairros, centroDoBairro, distanciaKm, distanciasDoBairro, imoveisDoBairro, limitarAPar, perguntasDoBairro, resumoDoBairro, slugBairro } from "./bairros.ts";

const UUID = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const ehExemplo = (id: string) => !/^[0-9a-f]{8}-/.test(id);
const im = (n: number, neighborhood: string, lat = -18.9, lng = -48.26) => ({ id: UUID(n), neighborhood, lat, lng });

test("slug sem acento, minúsculo e com hífen", () => {
  assert.equal(slugBairro("Santa Mônica"), "santa-monica");
  assert.equal(slugBairro("  Jardim  Umuarama "), "jardim-umuarama");
  assert.equal(slugBairro(""), "");
  assert.equal(slugBairro(null), "");
});

test("bairro sem imóvel real some; exemplo não conta; grafias iguais somam", () => {
  const lista = [im(1, "Santa Mônica"), im(2, "santa monica"), im(3, "Centro"), { id: "ube-001", neighborhood: "Tibery", lat: -18.9, lng: -48.2 }, im(4, "")];
  const g = agruparBairros(lista, ehExemplo);
  assert.deepEqual(g.map((b) => [b.slug, b.total]), [["santa-monica", 2], ["centro", 1]]);
  assert.equal(agruparBairros([], ehExemplo).length, 0);
});

test("grade par: ímpar tira o menos cheio; 1 sozinho fica; par intacto", () => {
  assert.deepEqual(limitarAPar([1, 2, 3]), [1, 2]);
  assert.deepEqual(limitarAPar([1]), [1]);
  assert.deepEqual(limitarAPar([1, 2, 3, 4]), [1, 2, 3, 4]);
  assert.deepEqual(limitarAPar([]), []);
});

test("imóveis do bairro filtram por slug e ignoram exemplo", () => {
  const lista = [im(1, "Centro"), im(2, "Tibery"), { id: "ube-002", neighborhood: "Centro", lat: 0, lng: 0 }];
  assert.equal(imoveisDoBairro("centro", lista, ehExemplo).length, 1);
});

test("centro do bairro é a média arredondada (nunca o ponto de um imóvel) e ignora coordenada zerada", () => {
  const c = centroDoBairro([{ lat: -18.9, lng: -48.2 }, { lat: -18.902, lng: -48.204 }, { lat: 0, lng: 0 }]);
  assert.deepEqual(c, { lat: -18.901, lng: -48.202 });
  assert.equal(centroDoBairro([{ lat: 0, lng: 0 }]), null);
  assert.equal(centroDoBairro([]), null);
});

test("haversine: 1° de latitude ≈ 111,2 km; mesmo ponto = 0", () => {
  assert.ok(Math.abs(distanciaKm({ lat: 0, lng: 0 }, { lat: 1, lng: 0 }) - 111.19) < 0.1);
  assert.equal(distanciaKm({ lat: -18.9, lng: -48.2 }, { lat: -18.9, lng: -48.2 }), 0);
});

test("distâncias: só ponto verificado, arredondado a 0,5 km (mín. 0,5), do mais perto ao mais longe", () => {
  const centro = { lat: 0, lng: 0 };
  const pontos = [
    { slug: "longe", nome: "Longe", lat: 0.03, lng: 0, verificado: true }, // ~3,34 km
    { slug: "perto", nome: "Perto", lat: 0.001, lng: 0, verificado: true }, // ~0,11 km → 0,5
    { slug: "duvida", nome: "Dúvida", lat: 0.01, lng: 0, verificado: false },
  ];
  const d = distanciasDoBairro(centro, pontos);
  assert.deepEqual(d.map((x) => [x.slug, x.km]), [["perto", 0.5], ["longe", 3.5]]);
  assert.match(d[0].texto, /^~0,5 km em linha reta$/);
  assert.deepEqual(distanciasDoBairro(null, pontos), []);
});

test("pontos de referência sem conferência não viram distância (nenhum número inventado)", () => {
  const d = distanciasDoBairro({ lat: -18.9, lng: -48.26 }, PONTOS_REFERENCIA);
  for (const p of PONTOS_REFERENCIA) if (!p.verificado) assert.ok(!d.some((x) => x.slug === p.slug));
  for (const p of PONTOS_REFERENCIA) if (p.verificado) assert.ok(p.lat !== 0 && p.fonte && !/pendente/.test(p.fonte));
});

test("textos do bairro: sem termos proibidos e sem preço inventado", () => {
  const todos = [resumoDoBairro("Centro", "Uberlândia", 3), ...perguntasDoBairro("Centro", "Uberlândia", null).flatMap((f) => [f.q, f.a]), ...perguntasDoBairro("Centro", "Uberlândia", 2500).map((f) => f.a)].join(" ");
  assert.doesNotMatch(todos, /temporada|aluguel|alugar|vistoria|comiss|corretag|intermedia|art\. 48/i);
  assert.match(perguntasDoBairro("Centro", "Uberlândia", null)[1].a, /Ainda não há anúncios suficientes/);
  assert.match(perguntasDoBairro("Centro", "Uberlândia", 2500)[1].a, /R\$ 2\.500/);
  assert.match(resumoDoBairro("Centro", "Uberlândia", 1), /1 imóvel mobiliado publicado/);
});

test("sitemap: um caminho por bairro com anúncio real, na cidade certa", () => {
  const lista = [{ ...im(1, "Centro"), city: "Uberlândia" }, { ...im(2, "centro"), city: "Uberlandia" }, { ...im(3, "Tibery"), city: "Araguari" }, { id: "ube-001", neighborhood: "Osvaldo", lat: 0, lng: 0, city: "Uberlândia" }];
  assert.deepEqual(caminhosDeBairros([{ slug: "uberlandia", name: "Uberlândia" }], lista, ehExemplo), ["/cidades/uberlandia/centro"]);
});
