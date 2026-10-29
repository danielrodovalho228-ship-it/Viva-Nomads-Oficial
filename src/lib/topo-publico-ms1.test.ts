/*
  MS-1/PUBLICO-A — topo público simples: Imóveis · Anunciar · Empresas + "Fale com a Viva" em texto + Entrar como único
  botão cheio. Publicar pedido, Como funciona, Preços e Parceiros saem do topo e moram no rodapé; Parceiros também
  aparece dentro do Fale com a Viva. Sem globo de idioma e sem menu "Mais" no topo.
  Roda: node --test src/lib/topo-publico-ms1.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const ler = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

test("topo: só Imóveis · Anunciar · Empresas; Fale com a Viva em texto; Entrar é o único botão cheio", () => {
  const nav = ler("lib/constants.ts").match(/PUBLIC_NAV = \[([\s\S]*?)\]/)![1];
  assert.deepEqual([...nav.matchAll(/label: "([^"]+)"/g)].map((m) => m[1]), ["Imóveis", "Anunciar", "Empresas"]);
  const topo = ler("components/layout/navbar.tsx");
  assert.equal((topo.match(/variant="primary"/g) ?? []).length, 2, "Entrar no computador e no menu do celular");
  assert.match(topo, /data-testid="nav-fale-com-a-viva"/);
  for (const fora of ["Publicar pedido", "Como funciona", "Preços", "Parceiros", "Mais", "Globe", "idioma"]) assert.doesNotMatch(topo, new RegExp(fora), fora);
});

test("rodapé: Publicar pedido, Como funciona, Preços e Parceiros", () => {
  const rodape = ler("components/layout/footer.tsx");
  for (const [href, nome] of [["/pedidos/novo", "Publicar pedido"], ["/como-funciona", "Como funciona"], ["/precos", "Preços"], ["/parceiros", "Parceiros"]])
    assert.match(rodape, new RegExp(`<FooterLink href="${href}">${nome}</FooterLink>`), nome);
});

test("Fale com a Viva: Parceiros aparece dentro da página", () => {
  assert.match(ler("app/(public)/ajuda/fale-com-a-viva/page.tsx"), /href="\/parceiros"[^>]*data-testid="fale-parceiros"/);
});
