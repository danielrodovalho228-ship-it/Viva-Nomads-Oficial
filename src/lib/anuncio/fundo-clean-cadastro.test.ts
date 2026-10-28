/* Roda: node --test src/lib/anuncio/fundo-clean-cadastro.test.ts — E195/E166 (cadastro clean, um primário só). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const ler = (p: string) => readFileSync(p, "utf8");
const NOVO = "src/app/(dashboard)/dashboard/imoveis/novo/";

test("o primário do rodapé do assistente não tem estado verde-claro próprio", () => {
  const rodape = ler(NOVO + "rodape-assistente.tsx");
  assert.doesNotMatch(rodape, /opacity-60/);
  assert.match(rodape, /disabled=\{p\.primario\.disabled\}/);
  assert.match(rodape, /className="shrink-0 sm:min-w-40"/);
});

test("o aviso de anúncio em andamento é um cartão clean (sem fundo tingido)", () => {
  const pagina = ler(NOVO + "page.tsx");
  assert.match(pagina, /data-testid="rascunho-aviso" className="[^"]*border-line bg-white/);
  assert.doesNotMatch(pagina, /bg-champagne\/10 p-4/);
});

test("Qualificação, cadastro e /qualificar sobre o mesmo fundo clean (surface-2)", () => {
  assert.match(ler("src/components/layout/moldura-assistente.tsx"), /bg-surface-2/);
  assert.match(ler("src/app/(dashboard)/qualificar/qualificar-client.tsx"), /bg-surface-2/);
});
