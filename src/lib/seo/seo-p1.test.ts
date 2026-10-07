import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { faqPage, jsonSeguro, listaImoveis, ofertasPlanos, organizacao, paginaCidade, servicoProprietarios } from "./estruturados.ts";
import { llmsFullTxt, llmsTxt } from "./llms.ts";

const URL_SITE = "https://vivanomads.com.br";
const ler = (p: string) => readFileSync(new URL(`../../../${p}`, import.meta.url), "utf8");

test("JSON-LD: Organization/WebSite, FAQPage, ofertas dos planos e lista só de imóveis reais", () => {
  const org = organizacao(URL_SITE);
  assert.deepEqual(org["@graph"].map((g) => g["@type"]), ["Organization", "WebSite"]);
  const faq = faqPage();
  assert.equal(faq["@type"], "FAQPage");
  assert.ok(faq.mainEntity.length >= 10);
  const ofertas = ofertasPlanos(URL_SITE);
  const gestor = ofertas.itemListElement.find((i) => i.item.name === "Plano Gestor")!;
  assert.ok(!("priceSpecification" in gestor.item), "Gestor é sob consulta: sem preço");
  const essencial = ofertas.itemListElement.find((i) => i.item.name === "Plano Essencial")!.item as { priceSpecification: { price: number; priceCurrency: string } };
  assert.equal(essencial.priceSpecification.priceCurrency, "BRL");
  const lista = listaImoveis(URL_SITE, [{ id: "ube-001", title: "Exemplo" }, { id: "11111111-1111-4111-8111-111111111111", title: "Real" }], (id) => id.startsWith("ube-"));
  assert.equal(lista.numberOfItems, 1);
  assert.equal(lista.itemListElement[0].url, `${URL_SITE}/imoveis/11111111-1111-4111-8111-111111111111`);
  // Título vindo do proprietário não quebra o <script>.
  assert.doesNotMatch(jsonSeguro({ t: "</script><img onerror=x>" }), /<\/script>|</);
});

test("#34: JSON-LD de /cidades/uberlandia (Place + ItemList só reais) e /para-proprietarios (Service)", () => {
  const ube = { slug: "uberlandia", name: "Uberlândia", state: "MG" };
  const cid = paginaCidade(URL_SITE, ube, [{ id: "ube-001", title: "Exemplo" }, { id: "11111111-1111-4111-8111-111111111111", title: "Real" }], (id) => id.startsWith("ube-"));
  assert.equal(cid["@context"], "https://schema.org");
  const [lugar, lista] = cid["@graph"];
  assert.equal(lugar["@type"], "Place");
  assert.deepEqual(lugar.address, { "@type": "PostalAddress", addressLocality: "Uberlândia", addressRegion: "MG", addressCountry: "BR" });
  assert.equal(lista["@type"], "ItemList");
  assert.equal(lista.numberOfItems, 1, "exemplo nunca entra");
  assert.equal(lista.url, `${URL_SITE}/cidades/uberlandia`);
  assert.ok(!("@context" in lista), "@context só no topo do @graph");
  assert.equal(paginaCidade(URL_SITE, ube, [], () => false)["@graph"][1].numberOfItems, 0);

  const serv = servicoProprietarios(URL_SITE, [ube]);
  assert.equal(serv["@type"], "Service");
  assert.equal(serv.provider["@id"], `${URL_SITE}/#organizacao`);
  assert.deepEqual(serv.areaServed, [{ "@type": "City", name: "Uberlândia, MG" }]);
  assert.doesNotMatch(JSON.stringify(serv), /aggregateRating|"price"/, "sem nota nem preço inventado");

  assert.match(ler("src/app/(public)/cidades/[cidade]/page.tsx"), /<JsonLd dados=\{paginaCidade\(SITE_URL, infoCidade, properties/);
  assert.match(ler("src/app/(public)/para-proprietarios/page.tsx"), /<JsonLd dados=\{servicoProprietarios\(SITE_URL, CITIES\)\} \/>/);
});

test("/llms.txt e /llms-full.txt: fatos oficiais, sem imóvel de exemplo e sem promessa proibida", () => {
  for (const t of [llmsTxt(URL_SITE), llmsFullTxt(URL_SITE)]) {
    assert.match(t, /^# Viva Nomads/);
    assert.match(t, /imóveis mobiliados/);
    assert.doesNotMatch(t, /ube-0|exemplo de anúncio|apartamento|garantia do aluguel|inquilino verificado|conta vinculada|Garantia de correspondência/i);
  }
  assert.match(llmsFullTxt(URL_SITE), /## Perguntas frequentes/);
  assert.match(llmsTxt(URL_SITE), /\/conferir/);
});

test("P1 dos agentes: /conferir, cidade indexável, sitemap honesto, /anunciar 301, sem 'Garantia de correspondência'", () => {
  assert.match(ler("src/app/(public)/conferir/page.tsx"), /redirect\(`\/conferir\/\$\{digitado\}`\)/);
  const cidade = ler("src/app/(public)/cidades/[cidade]/page.tsx");
  assert.match(cidade, /robots: \{ index: true, follow: true \}/);
  assert.doesNotMatch(cidade, /index: false/);
  const sitemap = ler("src/app/sitemap.ts");
  assert.doesNotMatch(sitemap, /new Date\(\)/, "sem lastmod inventado");
  assert.doesNotMatch(sitemap, /"\/cidades"|"\/uberlandia"|"\/anunciar"/);
  assert.match(ler("next.config.ts"), /source: "\/anunciar", destination: "\/para-proprietarios", statusCode: 301/);
  assert.doesNotMatch(ler("src/components/legal-notice.tsx") + ler("src/components/property/price-card.tsx"), /Garantia de correspondência|MatchGuaranteeNotice/);
});
