/**
 * E563 — página de preços SUSPENSA (decisão do Daniel, 04/11/2026): uma chave (PRECOS_VISIVEL, padrão DESLIGADA) governa
 * todas as portas para /precos; religar = ligar a chave (NEXT_PUBLIC_PRECOS_VISIVEL=1), sem retrabalho. `npm test`.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PRECOS_VISIVEL, chavePrecos, comPortasDePrecos, ehPortaDePrecos } from "../config/precos-visivel.ts";

const ler = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const NAV = [
  { href: "/buscar", label: "Imóveis" },
  { href: "/dashboard/imoveis/novo", label: "Anunciar" },
  { href: "/empresas", label: "Empresas" },
  { href: "/parceiros", label: "Parceiros" },
  { href: "/planos", label: "Planos" },
];

test("a chave vem DESLIGADA nesta entrega (sem a variável) e só liga com '1'", () => {
  assert.equal(PRECOS_VISIVEL, false);
  assert.equal(chavePrecos(undefined), false);
  assert.equal(chavePrecos("0"), false);
  assert.equal(chavePrecos("1"), true);
});

test("desligada: menu com 5 destinos (sem Planos); ligada: volta o Planos do E555", () => {
  assert.deepEqual(comPortasDePrecos(NAV, false).map((i) => i.label), ["Imóveis", "Anunciar", "Empresas", "Parceiros"]);
  assert.deepEqual(comPortasDePrecos(NAV, true), NAV);
  for (const h of ["/precos", "/planos", "/precos#plano-gestor", "/precos#compare"]) assert.equal(ehPortaDePrecos(h), true, h);
  assert.equal(ehPortaDePrecos("/parceiros"), false);
});

test("o menu público (computador e celular montam da mesma lista) passa pela chave", () => {
  assert.match(ler("lib/constants.ts"), /export const PUBLIC_NAV = comPortasDePrecos\(/);
});

test("rodapé, cartão da home e destaque de /anunciar só existem com a chave ligada", () => {
  assert.match(ler("components/layout/footer.tsx"), /\{PRECOS_VISIVEL && <FooterLink href="\/planos">Preços<\/FooterLink>\}/);
  const home = ler("app/(public)/page.tsx");
  assert.match(home, /\{PRECOS_VISIVEL && \(\s*<Link\s+href="\/planos"\s+data-testid="home-planos-taxas"/);
  const anunciar = ler("app/(public)/para-proprietarios/page.tsx");
  assert.match(anunciar, /\{PRECOS_VISIVEL && \(\s*<ButtonLink href="\/planos" variant="inverseSecondary" size="lg" data-testid="anunciar-planos">/);
});

test("as outras portas (texto de /anunciar, cartão de parceiros, comparativo, atendimento, sitemap) também passam pela chave", () => {
  assert.match(ler("app/(public)/para-proprietarios/page.tsx"), /PRECOS_VISIVEL \? \(/);
  // E896 (asserção alterada): o cartão dos gestores passa pela chave via linksDoCartaoGestores(PRECOS_VISIVEL) — com a chave
  // desligada não há porta para /precos e o cartão leva a /para-proprietarios#taxa (antes: comPortasDePrecos, que o deixava sem saída).
  assert.match(ler("app/(public)/parceiros/page.tsx"), /links: linksDoCartaoGestores\(PRECOS_VISIVEL\)/);
  assert.match(ler("lib/parceiros/tipos-parceria.ts"), /precosVisivel\s*\?\s*\[\{ href: "\/precos#plano-gestor"/);
  assert.match(ler("components/precos/comparativo-precos.tsx"), /PRECOS_VISIVEL && \(/);
  assert.match(ler("lib/atendimento/faq.ts"), /comPortasDePrecos\(\[LINK_PRECOS\]/);
  assert.match(ler("app/sitemap.ts"), /comPortasDePrecos\(/);
});

test("/precos não abre com a chave desligada (vai para a home); o código da página fica", () => {
  const pg = ler("app/(public)/precos/page.tsx");
  assert.match(pg, /if \(!PRECOS_VISIVEL\) redirect\("\/"\);/);
  assert.match(pg, /eyebrow="Preços"/, "o conteúdo do E555 continua no arquivo");
});

test("/planos e /dashboard/assinatura não expõem a página; o redirect só é permanente com a chave ligada", () => {
  const cfg = ler("../next.config.ts");
  assert.match(cfg, /const precosVisivel = process\.env\.NEXT_PUBLIC_PRECOS_VISIVEL === "1";/);
  assert.match(cfg, /\{ source: "\/planos", destination: precosVisivel \? "\/precos" : "\/", permanent: precosVisivel \}/);
  assert.match(cfg, /\{ source: "\/dashboard\/assinatura", destination: precosVisivel \? "\/precos" : "\/dashboard", permanent: false \}/);
});
