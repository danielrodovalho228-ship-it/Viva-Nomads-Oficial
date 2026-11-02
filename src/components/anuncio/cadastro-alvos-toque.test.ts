/*
  Varredura 02/11 (Pista A), cadastro do anúncio a 390 e 768 px (toque): quatro controles abaixo de 44 px.
  1. Regras: os interruptores dos blocos opcionais (silêncio, festas, visitas) — trilho de 28 px.
  2. Detalhes: "−" e "+" dos contadores — 36 px.
  3. Fotos: "Ver fotógrafos na cidade do imóvel" — 20 px.
  4. Preço: "Adicionar faixa de desconto" — 20 px.
  5. Revisão: "Faltam N itens antes de publicar" (abre o que falta) — 20 px.
  Todos ganham alvo de 44 px no toque (.alvo-toque), sem mudar o desenho.
  Roda: npm test
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const ler = (p: string) => readFileSync(new URL(`../../../${p}`, import.meta.url), "utf8");

test("interruptor do bloco opcional com alvo de 44 px", () => {
  assert.match(ler("src/components/anuncio/bloco-opcional.tsx"), /"alvo-toque relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors"/);
});

test("contadores: − e + com alvo de 44 px", () => {
  const c = ler("src/app/(dashboard)/dashboard/imoveis/novo/campos.tsx");
  assert.equal((c.match(/className="alvo-toque grid h-9 w-9 place-items-center rounded-full/g) ?? []).length, 2);
});

test("links de texto do cadastro com alvo de 44 px", () => {
  assert.match(ler("src/app/(dashboard)/dashboard/imoveis/novo/etapa-fotos.tsx"), /className="alvo-toque mt-1 inline-block font-medium text-forest underline" data-testid="porta-fotografo-link"/);
  assert.match(ler("src/components/anuncio/blocos-cadastro.tsx"), /className="alvo-toque mt-2 inline-flex items-center gap-1 text-sm font-medium text-forest underline"\n\s*data-testid="adicionar-faixa"/);
});

test("revisão: o motivo de não publicar (abre o que falta) com alvo de 44 px", () => {
  assert.match(ler("src/app/(dashboard)/dashboard/imoveis/novo/etapa-revisar.tsx"), /onClick=\{onMotivo\} className="alvo-toque block w-full text-balance text-center/);
});
