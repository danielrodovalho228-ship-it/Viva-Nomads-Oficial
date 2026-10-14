/*
  Ordem Daniel 13/10: página /empresas — link no menu e no rodapé, texto sem "aluguel",
  passos + FAQ, SEO (title ≤ 60, og:url).
  Roda: node --test src/lib/empresas-pagina.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const ler = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const page = ler("app/(public)/empresas/page.tsx");

test("/empresas está no menu público e no rodapé", () => {
  assert.match(ler("lib/constants.ts"), /PUBLIC_NAV = \[[\s\S]*?href: "\/empresas", label: "Para empresas"[\s\S]*?\];/);
  assert.match(ler("components/layout/footer.tsx"), /href="\/empresas"/);
});

test("/empresas: sem 'aluguel', usa 'estadia' e 'imóveis mobiliados'; nunca 'temporada'/'art. 48'", () => {
  assert.doesNotMatch(page, /aluguel|alugu/i);
  assert.match(page, /recibo mensal da estadia/i);
  assert.match(page, /imóveis mobiliados/);
  assert.doesNotMatch(page, /temporada|art\. ?48|8\.245/i);
});

test("/empresas: seção de 3 passos e FAQ com faturamento/recibo, prazo e assinatura", () => {
  assert.match(page, /Como funciona para a empresa/);
  assert.equal((page.match(/titulo: "/g) ?? []).length >= 6, true); // 3 pilares + 3 passos
  assert.match(page, /Como a empresa recebe o recibo\?/);
  assert.match(page, /De 30 a 180 dias/);
  assert.match(page, /Quem assina o contrato\?/);
});

test("/empresas: SEO — title ≤ 60, og:url, canonical e JSON-LD", () => {
  const t = /export const metadata[\s\S]*?title: "([^"]+)"/.exec(page)?.[1] ?? "";
  assert.ok(t.length > 0 && t.length <= 60, `title com ${t.length} caracteres`);
  assert.match(page, /openGraph: \{\s*url: "\/empresas"/);
  assert.match(page, /canonical: "\/empresas"/);
  assert.match(page, /<JsonLd/);
});
