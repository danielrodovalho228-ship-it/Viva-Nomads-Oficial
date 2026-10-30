/* Roda: node --test src/lib/anuncio/e193-passo6.test.ts — E193 (reteste de 30/10): Passo 6 no cartão grande da Qualificação. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const ler = (p: string) => readFileSync(p, "utf8");

test("Passo 6: 'O que considerar antes de pedir' em cartões de marcar (antes, pílulas); acesso segue em cartão de escolha única", () => {
  const c = ler("src/components/anuncio/chegada-e-pedido-campos.tsx");
  assert.doesNotMatch(c, /<Pilula\b/);
  assert.match(c, /<CartaoEscolha key=\{o\.chave\} papel="checkbox" on=\{value\.considerarAntes\.includes\(o\.chave\)\}/);
  assert.match(c, /role="radiogroup" aria-label="Como se entra no imóvel\?"[\s\S]{0,200}<CartaoEscolha/);
});

test("Passo 6: os sim/não (mobiliado, pets, crianças, fumar) no cartão grande, em grade", () => {
  const e = ler("src/app/(dashboard)/dashboard/imoveis/novo/etapa-encontramos.tsx");
  const regras = e.slice(e.indexOf('if (p.parte === "regras")'), e.indexOf('if (p.parte === "descricao")'));
  assert.match(regras, /className="grid gap-2 sm:grid-cols-2" data-testid="etapa-regras-casa"/);
  assert.match(ler("src/app/(dashboard)/dashboard/imoveis/novo/campos.tsx"), /export function Toggle[\s\S]{0,700}<CartaoEscolha/);
});
