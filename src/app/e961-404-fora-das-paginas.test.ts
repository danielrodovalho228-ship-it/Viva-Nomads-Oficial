/*
  E961 — a página 404 não viaja dentro das outras páginas.
  O Next monta o not-found.tsx da raiz em TODO pedido (ele é o conteúdo reserva do limite de "não encontrado" do
  layout) e manda o resultado no HTML de cada página. Enquanto a 404 lia os imóveis no servidor (listProperties) e
  desenhava três cartões, toda página do site pagava essa consulta e carregava os cartões, com preço, no próprio HTML —
  inclusive telas logadas como /dashboard/leads (t348: "R$ <número>" no HTML da tela do dono).
  Agora a vitrine da 404 é um componente de cliente: só busca os imóveis quando a 404 aparece de verdade.
  Roda: npm test. Na tela: t1661.
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const ler = (p: string) => readFileSync(new URL(p, import.meta.url), "utf8");
const pagina = ler("./not-found.tsx");
const vitrine = ler("../components/nao-encontrada/destaques-da-404.tsx");

test("E961: a 404 não lê imóveis nem desenha cartão no servidor", () => {
  assert.doesNotMatch(pagina, /listProperties/, "a 404 não consulta os imóveis no servidor");
  assert.doesNotMatch(pagina, /PropertyCard/, "nenhum cartão de imóvel sai do servidor na 404");
  assert.doesNotMatch(pagina, /export default async function/, "a 404 não espera dado nenhum");
  assert.match(pagina, /<DestaquesDa404 \/>/);
});

test("E961: a vitrine da 404 é de cliente e busca os imóveis só quando aparece", () => {
  assert.match(vitrine, /^"use client";/);
  assert.match(vitrine, /useProperties\("\/api\/properties"\)/);
  assert.match(vitrine, /\.slice\(0, 3\)/, "três destaques, como antes");
  // A grade par da varredura de 02/11 (2 destaques em 2 colunas; 3 em 1 e em 3 colunas) segue a mesma.
  assert.match(vitrine, /sm:grid-cols-2 sm:max-lg:\[&>:nth-child\(3\)\]:hidden lg:grid-cols-3/);
  assert.match(vitrine, /data-testid="nao-encontrada-destaques"/);
});

test("E961: enquanto busca, três cartões-fantasma na mesma grade (decisão do Gerente, ORDEM-DUET-069)", () => {
  assert.equal((vitrine.match(/<SkeletonCartao \/>/g) ?? []).length, 3, "três cartões-fantasma");
  // Uma grade só (constante GRADE) para o esqueleto e para os cartões: mesmas colunas, mesmo espaçamento, sem salto.
  assert.match(vitrine, /<div className=\{GRADE\} data-testid="nao-encontrada-esqueleto">/);
  assert.match(vitrine, /<div className=\{GRADE\} data-testid="nao-encontrada-destaques">/);
  // O título da seção já aparece no esqueleto (não entra depois, empurrando a página).
  assert.ok(vitrine.indexOf("Imóveis em destaque</h2>") < vitrine.indexOf("nao-encontrada-esqueleto"));
});
