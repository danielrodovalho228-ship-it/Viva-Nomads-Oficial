/* Roda: node --test src/lib/propostas/conta-unica.test.ts — E189 (a fórmula aberta da proposta é uma só). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { precoDaProposta } from "../precos.ts";
import { calcularTotais, type TermosProposta } from "./regras.ts";

test("ORC-2026-0002: 4 × (R$ 2.500 + condomínio R$ 200) + preparação R$ 450 = R$ 11.250 — a conta fecha", () => {
  const termos = { valorBase: 2500, descontoPct: 0, descontoValor: 0, descontoEstadiaPct: 0, condominio: 200, consumo: 0, limpezasMes: 0, valorLimpeza: 0, taxaPet: 0, meses: 4, limpezaUnica: 450 } as unknown as TermosProposta;
  const tot = calcularTotais(termos);
  const conta = precoDaProposta({ ...termos, valorMensal: tot.valorMensal }).conta;
  assert.match(conta ?? "", /^4 × R\$\s?2\.700 \+ .*R\$\s?450 = R\$\s?11\.250$/);
  assert.equal(tot.totalContrato, 11250);
});

test("mensagem (enviada, contraproposta, aceita) e lista do morador usam a mesma conta da tabela e do detalhe", () => {
  const acoes = readFileSync("src/lib/data/propostas-actions.ts", "utf8");
  assert.equal((acoes.match(/Total do contrato: \$\{contaDaProposta\(/g) ?? []).length, 3);
  assert.doesNotMatch(acoes, /\/mês × \$\{/);
  const lista = readFileSync("src/app/(dashboard)/dashboard/propostas/page.tsx", "utf8");
  assert.match(lista, /data-testid="proposta-inquilino-conta"[\s\S]{0,80}\{p\.conta \?\?/);
  assert.doesNotMatch(lista, /\/mês × \{p\.meses\}/);
});
