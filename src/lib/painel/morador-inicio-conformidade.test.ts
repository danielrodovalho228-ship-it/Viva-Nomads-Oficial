import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const src = readFileSync(new URL("../../app/(dashboard)/dashboard/visao-geral-client.tsx", import.meta.url), "utf8");
const inicio = src.slice(src.indexOf("function TenantDashboard"), src.indexOf("function DraftPendingCard"));

test("morador-inicio: 'Peça na Viva' com os textos aprovados, sem botão cheio a mais", () => {
  assert.match(inicio, /PECA_NA_VIVA\.titulo/);
  assert.match(inicio, /PECA_NA_VIVA\.principal\.href\} variant="outline"/);
  assert.match(inicio, /PECA_NA_VIVA\.secundario\.href\} variant="outline"/);
});

test("morador-inicio: recomendados com o cartão da busca, em grade par (2/4), 4 imóveis", () => {
  assert.match(inicio, /\.slice\(0, 4\)/);
  assert.match(inicio, /<PropertyCard key=\{p\.id\} property=\{p\} \/>/);
  assert.match(inicio, /grid-cols-2[^"]*lg:grid-cols-4/);
  assert.doesNotMatch(inicio, /PropertyRow/);
});

test("morador-inicio: 'Salve seus favoritos' só sem favoritos salvos", () => {
  assert.match(inicio, /\(demo \? 3 : favoritos\.length\) === 0 && \(/);
});
