/* Roda: node --test src/components/e454-primeira-pintura.test.ts
  E454: as fotos da primeira fileira de cartões carregam já e com prioridade alta (sem retângulo cinza na primeira pintura), e o
  espaço da foto já nasce reservado na proporção final (4:3). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const ler = (p: string) => readFileSync(p, "utf8");

test("E454: o cartão reserva a foto em 4:3 e repassa a prioridade só para a 1ª foto", () => {
  const card = ler("src/components/property-card.tsx");
  assert.match(card, /relative aspect-\[4\/3\] overflow-hidden rounded-xl bg-surface-2" data-testid="cartao-foto"/);
  assert.match(card, /export const PRIMEIRA_FILEIRA = 4;/);
  assert.match(card, /<FotosCartao fotos=\{fotos\} alt=\{property\.title\} prioridade=\{prioridade\} \/>/);
  const fotos = ler("src/components/property/fotos-cartao.tsx");
  assert.match(fotos, /priority=\{prioridade && i === 0\}/);
});

test("E454: a busca e as listas de cartões acima da dobra marcam a primeira fileira como prioridade", () => {
  assert.match(ler("src/app/(public)/buscar/search-client.tsx"), /prioridade=\{indice < PRIMEIRA_FILEIRA\}/);
  assert.match(ler("src/app/(public)/page.tsx"), /prioridade=\{i < PRIMEIRA_FILEIRA\}/);
  assert.match(ler("src/components/cidades/bairro-pagina.tsx"), /prioridade=\{n < PRIMEIRA_FILEIRA\}/);
  assert.match(ler("src/app/(public)/proprietario/[id]/page.tsx"), /prioridade=\{n < PRIMEIRA_FILEIRA\}/);
  assert.match(ler("src/components/favoritos-lista.tsx"), /prioridade=\{i < PRIMEIRA_FILEIRA\}/);
});

test("E454: a prioridade vira carga imediata com prioridade alta de rede no BrandImage (e as demais seguem preguiçosas)", () => {
  const b = ler("src/components/brand-image.tsx");
  assert.match(b, /priority \? \{ loading: "eager" as const, fetchPriority: "high" as const \} : \{\}/);
});
