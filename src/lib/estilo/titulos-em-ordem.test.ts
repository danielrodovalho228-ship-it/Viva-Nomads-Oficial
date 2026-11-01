import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const ler = (rel: string) => readFileSync(new URL(`../../${rel}`, import.meta.url), "utf8");

// Varredura 01/11 (achado 8): em 12 telas do painel o título pulava de h1 para h3 (leitor de tela perde a hierarquia).
test("estado vazio, candidato e cartão do imóvel no Fechamento são h2 (logo abaixo do h1 da tela)", () => {
  const prim = ler("components/dashboard/primitives.tsx");
  const vazio = prim.slice(prim.indexOf("export function EmptyState"), prim.indexOf("export function FilaVazia"));
  assert.match(vazio, /<h2 className="font-title text-base font-semibold text-ink">\{title\}<\/h2>/);
  assert.doesNotMatch(vazio, /<h3/);
  assert.match(ler("app/(dashboard)/dashboard/leads/leads-client.tsx"), /<h2 className="[^"]*" data-testid="candidato-nome">/);
  assert.match(ler("components/property-mini-card.tsx"), /<h2 className="mt-1 line-clamp-2 font-title/);
});
