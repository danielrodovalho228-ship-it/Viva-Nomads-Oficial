/*
  Varredura de erros (rodada 17): falha de leitura não vira "página inexistente" nem checklist vazio.
  • Checklist do avaliador: erro ao ler o pedido não é 404; erro ao ler itens/laudo/fotos não mostra checklist vazio
    (o avaliador refaria e sobrescreveria o que já salvou).
  • Concordância do morador: erro ao ler o pedido diz que não deu para abrir, em vez de 404.
  Roda: node --test src/lib/data/e293-leituras-r17.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const ler = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");

test("checklist do avaliador: falha ao ler pedido, itens, laudo ou fotos mostra aviso, não 404 nem lista vazia", () => {
  const s = ler("app/(dashboard)/dashboard/parceiro/avaliacao/[pedido]/page.tsx");
  assert.match(s, /const \{ data: p, error: erroPedido \}/);
  assert.match(s, /if \(erroPedido\) return/);
  assert.match(s, /if \(erroItens \|\| erroLaudos \|\| erroFotos\) return/);
  assert.ok(s.indexOf("if (erroPedido)") < s.indexOf("if (!p || dono !== user.id) notFound()"));
});

test("concordância do morador: falha ao ler o pedido mostra aviso, não 404", () => {
  const s = ler("app/(dashboard)/dashboard/avaliacao-imovel/[id]/page.tsx");
  assert.match(s, /const \{ data: p, error: erroPedido \}/);
  assert.ok(s.indexOf("if (erroPedido)") < s.indexOf("if (!p || p.morador_id !== user.id"));
});
