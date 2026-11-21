/*
  Auditoria de erros dos fluxos logados: falha de consulta não pode virar 404 ("não encontrado").
  Roda: node --test src/lib/erros/e-erros-consulta-nao-e-404.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const PAGINAS = [
  "src/app/(dashboard)/dashboard/parceiro/avaliacao/[pedido]/page.tsx",
  "src/app/(dashboard)/dashboard/avaliacao-imovel/[id]/page.tsx",
];

for (const p of PAGINAS) {
  test(`${p}: o erro da consulta vai para a tela de erro, antes de qualquer notFound()`, () => {
    const s = readFileSync(p, "utf8");
    const iErro = s.indexOf("if (erroPedido) throw");
    const iNotFound = s.indexOf("notFound()", s.indexOf("vistoria_pedidos"));
    assert.ok(iErro > 0, "lança o erro da consulta");
    assert.ok(iNotFound > iErro, "o throw vem antes do notFound()");
    assert.match(s, /error: erroPedido/);
  });
}

test("as telas de erro do painel e do admin existem e oferecem 'Tentar de novo'", () => {
  for (const p of ["src/app/(dashboard)/dashboard/error.tsx", "src/app/(dashboard)/admin/error.tsx"]) {
    assert.match(readFileSync(p, "utf8"), /Tentar de novo/, p);
  }
});
