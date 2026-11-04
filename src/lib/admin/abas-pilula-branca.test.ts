/**
 * Onda 5 (matriz admin-*, conteúdo × mockup): no admin, a aba/filtro ATIVO é pílula branca com texto colorido — o padrão do
 * admin (E351 c: "sem fundo colorido"). Antes, Documentos, Atendimento, Eventos e o filtro de período pintavam a aba ativa
 * de verde cheio (lia como um segundo botão cheio na tela) e Pedidos usava fundo sage. `npm test`.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { ABA_ADMIN } from "./abas.ts";

const ler = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");
const ARQUIVOS = [
  "app/(dashboard)/admin/atendimento/atendimento-client.tsx",
  "app/(dashboard)/admin/documentos/admin-documentos-client.tsx",
  "app/(dashboard)/admin/documentos/page.tsx",
  "app/(dashboard)/admin/eventos/page.tsx",
  "app/(dashboard)/admin/pedidos/admin-pedidos-client.tsx",
  "components/admin/filtros.tsx",
];

test("o estado ativo é pílula branca com texto colorido; o inativo, branca com borda neutra", () => {
  assert.match(ABA_ADMIN.ativa, /\bbg-white\b/);
  assert.match(ABA_ADMIN.ativa, /\btext-forest\b/);
  assert.match(ABA_ADMIN.ativa, /\bborder-ink\b/);
  assert.doesNotMatch(ABA_ADMIN.ativa, /\bbg-(forest|sage-\d+)\b/);
  assert.match(ABA_ADMIN.inativa, /\bbg-white\b/);
  assert.doesNotMatch(ABA_ADMIN.inativa, /\bbg-(forest|sage-\d+)\b/);
});

for (const arq of ARQUIVOS) {
  test(`${arq}: abas e filtros usam ABA_ADMIN, sem fundo verde ou sage no estado ativo`, () => {
    const src = ler(arq);
    assert.match(src, /ABA_ADMIN\.ativa/);
    assert.doesNotMatch(src, /\? "[^"]*\bbg-forest\b[^"]*text-white[^"]*"/, "antes: aba ativa com fundo verde cheio");
    assert.doesNotMatch(src, /\? "[^"]*\bbg-sage-100\b[^"]*"/, "antes: fundo sage no ativo/selo");
  });
}
