import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DESCRICAO_PRECO_MES, faqPageCidade, ofertaDoAnuncio, perguntasCidade } from "./anuncio-cidade.ts";

const SITE = "https://vivanomads.com.br";
const ler = (p: string) => readFileSync(new URL(`../../../${p}`, import.meta.url), "utf8");
const casa = { id: "11111111-1111-4111-8111-111111111111", monthlyPrice: 3200, city: "Uberlândia", state: "MG", neighborhood: "Centro", bedrooms: 2, bathrooms: 1, areaM2: 62, minPeriodDays: 30, maxPeriodDays: 120, furnished: true };

test("#9f68d9d3: Offer + Accommodation com preço mensal, estadia mín/máx, mobiliado, cidade e bairro", () => {
  const o = ofertaDoAnuncio(SITE, casa, "https://schema.org/InStock");
  assert.equal(o["@type"], "Offer");
  assert.equal(o.price, 3200);
  assert.equal(o.priceSpecification.unitCode, "MON");
  assert.equal(o.availability, "https://schema.org/InStock");
  assert.deepEqual([o.eligibleDuration.minValue, o.eligibleDuration.maxValue, o.eligibleDuration.unitCode], [30, 120, "DAY"]);
  assert.equal(o.itemOffered["@type"], "Accommodation");
  assert.equal(o.itemOffered.numberOfBedrooms, 2);
  assert.equal(o.itemOffered.amenityFeature[0].name, "Mobiliado");
  assert.equal(o.itemOffered.address.addressLocality, "Uberlândia");
  assert.equal(o.itemOffered.containedInPlace?.name, "Centro");
});

test("E98-A: o preço da oferta é o TOTAL do mês (calcularTudoIncluido), por mês, com a descrição do que inclui", () => {
  // O Premium de teste: 2.900 de valor mensal + 220 de condomínio + 220 de contas fixas = 3.340.
  const premium = { ...casa, monthlyPrice: 2900, condoFee: 220, utilitiesMode: "fixed" as const, utilitiesEstimate: 220 };
  const o = ofertaDoAnuncio(SITE, premium, "https://schema.org/InStock");
  assert.equal(o.price, 3340);
  assert.equal(o.priceSpecification.price, 3340);
  assert.equal(o.priceSpecification.unitCode, "MON");
  assert.equal(o.description, "Valor do mês com condomínio e contas fixas incluídos");
  assert.equal(DESCRICAO_PRECO_MES, o.description);
  // Contas medidas (regime "real") não entram no total (a mesma regra do cartão).
  assert.equal(ofertaDoAnuncio(SITE, { ...premium, utilitiesMode: "real" as const }, "https://schema.org/InStock").price, 3120);
});

test("#9f68d9d3: sem limite máximo no anúncio vale 180; sem endereço completo nem coordenada", () => {
  const o = ofertaDoAnuncio(SITE, { ...casa, maxPeriodDays: undefined, neighborhood: undefined }, "https://schema.org/PreOrder");
  assert.equal(o.eligibleDuration.maxValue, 180);
  assert.ok(!("containedInPlace" in o.itemOffered));
  assert.doesNotMatch(JSON.stringify(o), /streetAddress|postalCode|"geo"|latitude|longitude/i);
});

test("#9f68d9d3: FAQPage da cidade usa as perguntas da tela e respeita o vocabulário público", () => {
  const faq = faqPageCidade("Uberlândia");
  assert.equal(faq["@type"], "FAQPage");
  assert.deepEqual(faq.mainEntity.map((q) => q.name), perguntasCidade("Uberlândia").map((p) => p.pergunta));
  const texto = JSON.stringify(faq);
  assert.match(texto, /30 a 180 dias/);
  assert.match(texto, /Caução/);
  assert.doesNotMatch(texto, /alugu|comiss|corretag|intermedia|vistoria|temporada|art\. ?48/i);
});

test("a página da cidade e o JSON-LD do anúncio usam os construtores", () => {
  const cidade = ler("src/app/(public)/cidades/[cidade]/page.tsx");
  assert.match(cidade, /<JsonLd dados=\{faqPageCidade\(name\)\} \/>/);
  assert.match(ler("src/components/seo/property-json-ld.tsx"), /ofertaDoAnuncio\(SITE_URL, property, disponibilidadeSchema\(property\)\)/);
});
