/*
  E161: o assistente de cadastro usa a régua da página do imóvel (largura total responsiva, desde o #666), em todos os
  passos, no computador e no celular; a prévia lateral tem a largura do cartão lateral do anúncio, e "Ver no tamanho
  real" mostra o anúncio com as peças da própria página do imóvel.
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const ler = (p: string) => readFileSync(p, "utf8");
const IMOVEL = ler("src/app/(public)/imoveis/[id]/property-detail.tsx");
const MOLDURA = ler("src/components/layout/moldura-assistente.tsx");
const NOVO = ler("src/app/(dashboard)/dashboard/imoveis/novo/page.tsx");
const REAL = ler("src/app/(dashboard)/dashboard/imoveis/novo/previa-tamanho-real.tsx");
const classesDe = (src: string, marca: string) => (src.split("\n").find((l) => l.includes(marca)) ?? "").match(/className="([^"]+)"/)?.[1].split(/\s+/) ?? [];

test("E161: a moldura do assistente tem a mesma largura máxima e as mesmas margens da página do imóvel", () => {
  const imovel = classesDe(IMOVEL, 'data-testid="imovel-largura-total"');
  const assistente = classesDe(MOLDURA, 'data-testid="assistente-largura"');
  for (const c of ["mx-auto", "w-full", "max-w-[1536px]", "px-4", "sm:px-8"]) {
    assert.ok(imovel.includes(c), `página do imóvel: ${c}`);
    assert.ok(assistente.includes(c), `assistente: ${c}`);
  }
  assert.doesNotMatch(MOLDURA, /max-w-6xl/, "sem a coluna estreita antiga");
});

test("E161: a grade do assistente é a da página do imóvel (conteúdo + coluna lateral 22rem/26rem)", () => {
  const grade = /lg:grid-cols-\[minmax\(0,1fr\)_22rem\] xl:grid-cols-\[minmax\(0,1fr\)_26rem\] xl:gap-12/;
  assert.match(IMOVEL, grade);
  assert.match(NOVO, grade);
});

test("E161: 'Ver no tamanho real' usa a galeria e o cartão de preço da página do imóvel, na mesma régua", () => {
  assert.match(REAL, /<PropertyGallery photos=\{imovel\.photos\}/);
  assert.match(REAL, /<PriceCard\b/);
  assert.match(REAL, /className="mx-auto w-full max-w-\[1536px\] px-4 py-8 sm:px-8" data-testid="previa-real-largura"/);
  // E242: no cartão da prévia, embaixo da foto (computador; na Revisão, no cartão do anúncio) e no fim do passo (celular).
  assert.match(NOVO, /tamanhoReal=\{<BotaoTamanhoReal imovel=\{previewProperty\} className="mt-2" \/>\}/);
  assert.match(NOVO, /tamanhoReal=\{<BotaoTamanhoReal imovel=\{previewProperty\} className="mt-2 hidden lg:inline-flex" \/>\}/);
  assert.match(NOVO, /<div className="mt-6 lg:hidden" data-testid="previa-tamanho-real-passo">/);
});

test("E161: o rodapé do fluxo alinha com a régua de 1536 px (96rem), não com a moldura antiga (72rem)", () => {
  const css = ler("src/app/globals.css");
  assert.match(css, /\.vn-rodape-fluxo \[data-rodape-linha\] \{\s*padding-inline: max\(2rem, calc\(\(100% - 96rem\) \/ 2 \+ 2rem\)\);/);
  assert.doesNotMatch(css, /100% - 72rem/);
});

test("E161: a faixa da direita do flutuante (CONTA-A C4) não vale no assistente, que não tem o flutuante", () => {
  const css = ler("src/app/globals.css");
  assert.match(css, /html:not\(\[data-app\]\) \[data-painel-main\]:not\(\[data-testid="assistente-largura"\]\) \{\s*padding-right: 5rem;/);
  assert.match(MOLDURA, /data-painel-main[^>]*data-testid="assistente-largura"/);
});

test("E161: o botão do tamanho real aparece uma vez no passo (sem bloco duplicado)", () => {
  assert.equal((NOVO.match(/data-testid="previa-tamanho-real-passo"/g) ?? []).length, 1);
});

test("E161: o tamanho real abre no document.body (portal), por cima do topo e do rodapé do assistente", () => {
  assert.match(REAL, /createPortal\(/);
  assert.match(REAL, /document\.body,/);
});
