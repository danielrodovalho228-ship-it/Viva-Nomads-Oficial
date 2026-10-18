import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { faqPage, jsonSeguro, listaImoveis, ofertaRegraUnica, organizacao, paginaCidade, servicoProprietarios } from "./estruturados.ts";
import { llmsFullTxt, llmsTxt } from "./llms.ts";

const URL_SITE = "https://vivanomads.com.br";
const ler = (p: string) => readFileSync(new URL(`../../../${p}`, import.meta.url), "utf8");

test("JSON-LD: Organization/WebSite, FAQPage, oferta da regra única e lista só de imóveis reais", () => {
  const org = organizacao(URL_SITE);
  assert.deepEqual(org["@graph"].map((g) => g["@type"]), ["Organization", "WebSite"]);
  const faq = faqPage();
  assert.equal(faq["@type"], "FAQPage");
  assert.ok(faq.mainEntity.length >= 10);
  const oferta = ofertaRegraUnica(URL_SITE);
  assert.equal(oferta.price, 0);
  assert.equal(oferta.priceCurrency, "BRL");
  assert.match(oferta.description, /12% sobre o valor total do contrato fechado/);
  assert.doesNotMatch(JSON.stringify(oferta), /Essencial|Profissional|Gestor/);
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

test("#9f68d9d3: robots libera bots de IA nas páginas públicas e mantém as áreas privadas bloqueadas", async () => {
  const { BOTS_DE_IA, AREAS_PRIVADAS } = await import("./robots-regras.ts");
  const src = ler("src/app/robots.ts");
  assert.match(src, /userAgent: BOTS_DE_IA, allow: "\/", disallow: AREAS_PRIVADAS/);
  assert.match(src, /userAgent: "\*", allow: "\/", disallow: AREAS_PRIVADAS/);
  const regras = [{ userAgent: BOTS_DE_IA, allow: "/", disallow: AREAS_PRIVADAS }, { userAgent: "*", allow: "/", disallow: AREAS_PRIVADAS }];
  for (const bot of ["GPTBot", "OAI-SearchBot", "ChatGPT-User", "ClaudeBot", "PerplexityBot", "Google-Extended"]) {
    const regra = regras.find((x) => [x.userAgent].flat().includes(bot));
    assert.ok(regra, `${bot} sem regra própria`);
    assert.equal(regra.allow, "/");
    for (const area of ["/dashboard", "/admin", "/api"]) assert.ok((regra.disallow as string[]).includes(area), `${bot} deve ficar fora de ${area}`);
  }
  assert.equal(BOTS_DE_IA.length, 6);
  assert.ok(AREAS_PRIVADAS.includes("/admin"));
  assert.ok(regras.some((x) => x.userAgent === "*"));
});

test("#bd33852c (#114): llms sem 'comissão'/'assinatura'/'vistoria', com o aviso de fase de testes", () => {
  for (const t of [llmsTxt(URL_SITE), llmsFullTxt(URL_SITE)]) {
    assert.doesNotMatch(t, /comiss|assinatura|vistoria/i);
    assert.match(t, /Plataforma em fase de testes\. Lançamento oficial em 2027\./);
    assert.match(t, /12%/);
  }
});

test("#93089e14 (#36/#61/#113): títulos <= 60 com o sufixo da marca e og:url da própria página", () => {
  const sufixo = " · Viva Nomads";
  const home = ler("src/app/layout.tsx").match(/default:\s*"([^"]+)"/)![1];
  assert.ok(home.length <= 60, `home com ${home.length}`);
  assert.match(home, /imóveis mobiliados/i);
  assert.match(home, /30 a 180 dias/);
  for (const [arq, og] of [["src/app/(public)/precos/page.tsx", null], ["src/app/(public)/para-proprietarios/page.tsx", "/para-proprietarios"]] as const) {
    const src = ler(arq);
    const t = src.match(/title:\s*"([^"]+)"/)![1];
    assert.ok((t + sufixo).length <= 60, `${arq}: ${(t + sufixo).length} caracteres com o sufixo`);
    if (og) assert.match(src, new RegExp(`openGraph:\\s*\\{[^}]*url:\\s*"${og}"`));
  }
});

test("robots: o layout raiz não declara 'index, follow' (vazava nas 404 com not-found próprio, junto do noindex)", () => {
  const layout = ler("src/app/layout.tsx");
  const bloco = layout.slice(layout.indexOf("robots: {"), layout.indexOf("},", layout.indexOf("robots: {")) + 2);
  assert.doesNotMatch(bloco, /index:\s*true|follow:\s*true/);
  assert.match(bloco, /"max-image-preview": "large"/);
});

test("h1: a Visão geral do inquilino tem título principal, como a do proprietário (varredura t48)", () => {
  const src = ler("src/app/(dashboard)/dashboard/visao-geral-client.tsx");
  const inquilino = src.slice(src.indexOf("function TenantDashboard"), src.indexOf("function DraftPendingCard"));
  assert.match(inquilino, /<PageTitle title="Visão geral"/);
});
