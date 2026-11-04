/**
 * E555 — pacote Planos: as portas para /planos (que redireciona à página de planos e taxas, /precos).
 *  - menu público com 6 destinos: Imóveis · Anunciar · Empresas · Parceiros · Planos · Fale com a Viva (computador e
 *    celular montam da mesma lista);
 *  - cartão "Planos e taxas" no bloco de proprietários da home;
 *  - "Preços" no rodapé aponta para /planos;
 *  - destaque no topo de /anunciar (= /para-proprietarios) aponta para /planos.
 * `npm test`.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const ler = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

function destinos(): string[][] {
  const c = ler("lib/constants.ts");
  const nav = c.match(/export const PUBLIC_NAV = \[([\s\S]*?)\] as/)![1];
  const fale = c.match(/export const FALE_COM_A_VIVA = (\{[^}]*\})/)![1];
  return [...nav.matchAll(/\{ href: "([^"]+)", label: "([^"]+)" \}/g), ...fale.matchAll(/\{ href: "([^"]+)", label: "([^"]+)" \}/g)].map((m) => [m[2], m[1]]);
}

test("E555: menu público com exatamente 6 destinos, nesta ordem", () => {
  assert.deepEqual(destinos(), [
    ["Imóveis", "/buscar"],
    ["Anunciar", "/dashboard/imoveis/novo"],
    ["Empresas", "/empresas"],
    ["Parceiros", "/parceiros"],
    ["Planos", "/planos"],
    ["Fale com a Viva", "/ajuda/fale-com-a-viva"],
  ]);
});

test("E555: /planos continua levando à página de planos e taxas", () => {
  assert.match(ler("../next.config.ts"), /\{ source: "\/planos", destination: "\/precos", permanent: true \}/);
});

test("E555: cartão 'Planos e taxas' no bloco de proprietários da home, para /planos", () => {
  const home = ler("app/(public)/page.tsx");
  const bloco = home.slice(home.indexOf('data-testid="bloco-proprietarios"'), home.indexOf("IMÓVEIS EM DESTAQUE"));
  assert.match(bloco, /href="\/planos"[^>]*data-testid="home-planos-taxas"/);
  assert.match(bloco, /Planos e taxas/);
  // uma porta só para a página de planos dentro do bloco (o "Ver preços" solto saiu)
  assert.doesNotMatch(bloco, /href="\/precos"/);
});

test("E555: 'Preços' no rodapé aponta para /planos", () => {
  assert.match(ler("components/layout/footer.tsx"), /<FooterLink href="\/planos">Preços<\/FooterLink>/);
});

test("E555: o topo de /anunciar (para-proprietarios) tem o destaque para /planos", () => {
  assert.match(ler("../next.config.ts"), /\{ source: "\/anunciar", destination: "\/para-proprietarios"/);
  const p = ler("app/(public)/para-proprietarios/page.tsx");
  const topo = p.slice(p.indexOf("<BannerTopo"), p.indexOf("</BannerTopo>"));
  assert.match(topo, /<ButtonLink href="\/planos" variant="inverseSecondary" size="lg" data-testid="anunciar-planos">\s*Planos e taxas/);
});
