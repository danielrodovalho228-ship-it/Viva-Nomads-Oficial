import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

/*
  Frente 3 (t286, Prompt 48): ao navegar para o imóvel, o esqueleto (loading.tsx) aparece antes da resposta.
  No Next 16.4 (30964ddfb), rota ISR com generateStaticParams não pré-carrega nada para um id que ainda não
  foi gerado: a tela fica parada na busca até a resposta inteira chegar. Sem generateStaticParams a rota é
  dinâmica e o pré-carregamento traz o layout até o loading.tsx (docs: "Prefetching static vs. dynamic routes").
  A rede de segurança de 60 s (revalidate) e o 404 de verdade do layout (t176) continuam.
*/
const dir = "src/app/(public)/imoveis/[id]";
const pagina = readFileSync(`${dir}/page.tsx`, "utf8");

test("a página do imóvel não exporta generateStaticParams (o esqueleto entra no pré-carregamento)", () => {
  assert.doesNotMatch(pagina, /export (async )?function generateStaticParams/);
  assert.match(readFileSync(`${dir}/loading.tsx`, "utf8"), /SkeletonDetalheImovel/);
});

test("continua com revalidate de 60 s e com o 404 do layout antes do loading.tsx", () => {
  assert.match(pagina, /export const revalidate = 60;/);
  assert.match(readFileSync(`${dir}/layout.tsx`, "utf8"), /notFound\(\)/);
});
