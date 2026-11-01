import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const ler = (p: string) => readFileSync(new URL(p, import.meta.url), "utf8");

test("achado 42: o pedido do parceiro no admin não vira 404 nem histórico vazio quando a leitura falha", () => {
  const pagina = ler("../../app/(dashboard)/admin/parceiros/pedidos/[id]/page.tsx");
  assert.match(pagina, /\{ data: p, error: erroPedido \}, \{ data: ev, error: erroEventos \}/);
  const lanca = pagina.indexOf("if (falha) throw new Error");
  assert.ok(lanca > 0 && lanca < pagina.indexOf("if (!p) notFound();"), "o erro sobe antes do 404");
});
