/** E458 (Relay 58) — "Parceiros" no menu público e a porta com dois caminhos — `npm test`. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const ler = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

// constants.ts importa por "@/": lido como texto (como os demais testes do topo).
function destinos(): string[][] {
  const c = ler("lib/constants.ts");
  const nav = c.match(/export const PUBLIC_NAV = comPortasDePrecos\(\[([\s\S]*?)\] as/)![1];
  const fale = c.match(/export const FALE_COM_A_VIVA = (\{[^}]*\})/)![1];
  return [...nav.matchAll(/\{ href: "([^"]+)", label: "([^"]+)" \}/g), ...fale.matchAll(/\{ href: "([^"]+)", label: "([^"]+)" \}/g)].map((m) => [m[2], m[1]]);
}

// E563: a lista do código é a do E555 (com Planos); a chave PRECOS_VISIVEL tira o Planos enquanto a página estiver suspensa.
// E555: o menu ganhou "Planos" (6 destinos) — a lista completa mora em e555-planos-portas.test.ts.
test("menu público: os destinos do E458 seguem, nesta ordem", () => {
  assert.deepEqual(
    destinos(),
    [
      ["Imóveis", "/buscar"],
      ["Anunciar", "/para-proprietarios"],
      ["Empresas", "/empresas"],
      ["Parceiros", "/parceiros"],
      ["Planos", "/planos"],
      ["Fale com a Viva", "/ajuda/fale-com-a-viva"],
    ]
  );
});

test("computador e celular montam o menu da MESMA lista", () => {
  const nav = ler("components/layout/navbar.tsx");
  assert.equal(nav.match(/PUBLIC_NAV\.map/g)?.length, 2);
});

test("/parceiros: os dois caminhos no topo, com os destinos certos; a busca aponta de volta", () => {
  const pagina = ler("app/(public)/parceiros/page.tsx");
  assert.match(pagina, /href="\/parceiros\/buscar"[^>]*data-testid="porta-encontrar-parceiro"[^>]*>\s*Encontrar um parceiro/);
  assert.match(pagina, /href="#quero-ser-parceiro"[^>]*data-testid="porta-quero-ser-parceiro"[^>]*>\s*Quero ser parceiro/);
  assert.match(pagina, /id="quero-ser-parceiro"/);
  assert.ok(pagina.indexOf('data-testid="parceiros-porta"') < pagina.indexOf("<BannerTopo"), "a porta vem antes do conteúdo atual");
  const busca = ler("app/(public)/parceiros/buscar/page.tsx");
  assert.match(busca, /É profissional\?\{" "\}\s*<Link href="\/parceiros"[^>]*>\s*Seja parceiro da Viva/);
});

// E711: as duas portas do topo já levam a "Quero ser parceiro" — o banner logo abaixo não repete o mesmo destino.
test("/parceiros: na primeira tela só uma ação leva a #quero-ser-parceiro (sem CTA duplicado no banner)", () => {
  const pagina = ler("app/(public)/parceiros/page.tsx");
  const banner = pagina.slice(pagina.indexOf("<BannerTopo"), pagina.indexOf("</BannerTopo>"));
  assert.doesNotMatch(banner, /href="#quero-ser-parceiro"/);
  assert.doesNotMatch(pagina, /seja-parceiro-topo/);
  assert.match(banner, /Ver tipos de parceria/);
});
