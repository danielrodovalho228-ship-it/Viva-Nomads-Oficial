import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const ler = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

test("varredura do painel 01/11: rótulos visíveis dizem 'Morador', nunca 'Inquilino'", () => {
  const fech = ler("app/(dashboard)/dashboard/fechamento/closing-flow.tsx");
  assert.match(fech, /Morador: \{tenant\.name\}/);
  assert.match(fech, /"Proprietário" : "Morador"/);
  assert.match(ler("app/(dashboard)/dashboard/reembolsos/page.tsx"), /<Row label="Morador"/);
  assert.match(ler("components/manutencao/cartao-ordem.tsx"), /inquilino: "Morador"/);
});

test("varredura do painel 01/11: Indicações sem 'reserva'", () => {
  const ind = ler("app/(dashboard)/dashboard/indicacoes/page.tsx");
  assert.doesNotMatch(ind, /(primeira|1ª) reserva/i);
  assert.match(ind, /Aguardando 1ª locação/);
});
