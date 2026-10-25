/* Roda: node --test src/lib/propostas/primeiro-pagamento-detalhe.test.ts — E178: "1º pagamento" no detalhe da proposta. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { precoDaProposta, primeiroPagamentoDoPreco } from "../precos.ts";

test("o 1º pagamento da proposta é o 1º mês com tudo + a limpeza de preparação (a conta do Fechamento)", () => {
  const preco = precoDaProposta({ valorMensal: 3200, condominio: 450, consumo: 0, limpezasMes: 0, valorLimpeza: 0, taxaPet: 0, meses: 4, limpezaUnica: 200 } as Parameters<typeof precoDaProposta>[0]);
  assert.equal(primeiroPagamentoDoPreco(preco), 3850);
});

test("o detalhe da proposta mostra a linha '1º pagamento' com essa conta", () => {
  const tela = readFileSync(new URL("../../app/(dashboard)/dashboard/propostas/[id]/proposta-detalhe.tsx", import.meta.url), "utf8");
  assert.match(tela, /data-testid="proposta-primeiro-pagamento"/);
  assert.match(tela, /rotulo="1º pagamento" valor=\{formatBRL\(primeiroPagamentoDoPreco\(preco\)\)\}/);
});
