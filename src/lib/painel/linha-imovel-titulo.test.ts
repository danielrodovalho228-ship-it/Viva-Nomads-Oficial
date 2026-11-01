/* Conformidade (31/10): na linha de imóvel do painel (Imóveis recomendados do Início), o título vai até 2 linhas, como
   em "Meus imóveis" na mesma tela; não corta numa linha só. Roda: node --test src/lib/painel/linha-imovel-titulo.test.ts */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("PropertyRow: título com line-clamp-2, sem truncate", () => {
  const c = readFileSync("src/components/dashboard/property-row.tsx", "utf8");
  assert.match(c, /<span className="line-clamp-2 text-sm font-medium text-ink" data-testid="linha-imovel-titulo">\{title\}<\/span>/);
  assert.doesNotMatch(c, /block truncate text-sm font-medium/);
});
