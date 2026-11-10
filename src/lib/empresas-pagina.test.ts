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
  assert.match(ler("lib/constants.ts"), /PUBLIC_NAV = comPortasDePrecos\(\[[\s\S]*?href: "\/empresas", label: "Empresas"[\s\S]*?\]\);/);
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
  assert.equal((page.match(/titulo: "/g) ?? []).length >= 5, true); // 2 pilares (E772 tirou Relatórios) + 3 passos
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

test("E770/E771/E772: prazo e taxa explícitos, escopo do dinheiro nas duas páginas, nada 'em construção' anunciado", () => {
  assert.match(page, /A equipe responde em até 7 dias, no e-mail informado/); // decisão do Daniel, 09/11
  assert.match(page, /Respondemos em até 7 dias com opções de imóveis mobiliados/);
  assert.doesNotMatch(page, /Ainda não há prazo de resposta/);
  assert.match(page, /A taxa da Viva é do proprietário, por contrato fechado/);
  assert.match(page, /pagamento da estadia vai direto ao proprietário/);
  assert.match(page, /Serviços de parceiros \(limpeza, mudança\) são contratados à parte/);
  assert.doesNotMatch(page, /em construção|Relatórios|relatórios/);
  assert.doesNotMatch(page, /fatura/i); // quem emite é o proprietário, e é RECIBO (FAQ "Como a empresa recebe o recibo?")
  const regras = ler("components/parceiros/regras-parceiros.tsx");
  assert.match(regras, /ESCOPO_PAGAMENTO_PARCEIROS/);
  assert.match(ler("lib/parceiros/regras.ts"), /Esta divisão vale só para os serviços de parceiros\. O pagamento da estadia vai direto ao proprietário/);
});
