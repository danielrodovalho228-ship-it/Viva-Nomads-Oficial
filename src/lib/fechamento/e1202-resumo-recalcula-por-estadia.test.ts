/*
  E1202 (ORDEM-DUET-972/973) — a base, a taxa e a caução do assistente recalculam-se com a estadia aberta.
  Antes: na passagem de 25/11, o assistente da ORC-2026-0015 (R$ 2.500, 31 dias; base certa R$ 2.583,33) mostrava
  "Base R$ 2.893", "Taxa R$ 347" e, na Garantia, "Bloco 1 Aluguel R$ 2.893 · Caução R$ 1.447" — o aluguer da
  ORC-2026-0018 (R$ 2.800, os MESMOS 31 dias). O `resumo` (base, taxa, caução, blocos) era um `useMemo` que só
  dependia de [prazoMeses, DIAS_ACORDO]: com a instância reaproveitada (E1201) e os mesmos dias, nunca recalculou.
  Só exibição: a cobrança e o contrato vêm do servidor.
  Depois: o `useMemo` do `resumo` depende de TUDO o que lê da estadia (aluguel, taxa, prazo); o do modelo de contrato
  também (o tipo do imóvel).
  Roda: node --test src/lib/fechamento/e1202-resumo-recalcula-por-estadia.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fonteSemComentarios } from "../fonte-sem-comentarios.ts";

const fluxo = fonteSemComentarios(readFileSync("src/app/(dashboard)/dashboard/fechamento/closing-flow.tsx", "utf8"));

/** As dependências declaradas do `useMemo` que começa em `const nome = useMemo(`. */
function dependencias(nome: string): string[] {
  const i = fluxo.indexOf(`const ${nome} = useMemo(`);
  assert.ok(i >= 0, nome);
  let n = 0;
  let j = fluxo.indexOf("(", i);
  for (; j < fluxo.length; j++) {
    if (fluxo[j] === "(") n++;
    else if (fluxo[j] === ")" && --n === 0) break;
  }
  const corpo = fluxo.slice(i, j);
  const m = /,\s*\[([^\]]*)\]\s*$/.exec(corpo);
  assert.ok(m, `${nome}: dependências declaradas`);
  return m[1].split(",").map((s) => s.trim()).filter(Boolean);
}

test("o resumo (base, taxa, caução, blocos) recalcula-se com o aluguel, a taxa e o prazo da estadia aberta", () => {
  const deps = dependencias("resumo");
  for (const d of ["prazoMeses", "DIAS_ACORDO", "PROPERTY.monthlyRent", "COMMISSION_RATE"]) assert.ok(deps.includes(d), `resumo depende de ${d}`);
});

test("o modelo de contrato recalcula-se com a faixa e o tipo do imóvel", () => {
  const deps = dependencias("MODELO_CONTRATO");
  for (const d of ["FAIXA", "PROPERTY_FULL.propertyType"]) assert.ok(deps.includes(d), `MODELO_CONTRATO depende de ${d}`);
});
