/*
  E672 (07/11, retomada do E652): a remarcação mostrava só "Entrada: de 10/01/2027 para 17/01/2027" + "Taxa de serviço do
  aditivo: sem alteração" — sem dias, sem saída, sem novo total e sem diferença. O aditivo agora traz o comparativo
  antes × depois (entrada, saída, dias exatos, total) e a diferença a pagar/devolver, mais o motivo, e o texto assinado
  cobre tudo isso.
  Roda: node --test src/lib/estadia/e672-comparativo-aditivo.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fimInclusivoISO } from "../contrato-blocos.ts";
import { comparativoDoAditivo, linhasDoAditivo, resumoDasMudancas, validarProposta, type ContratoParaAditivo } from "./aditivo.ts";

const CONTRATO: ContratoParaAditivo = {
  valorMensal: 3000,
  ocupantes: 1,
  capacidade: 2,
  tamanhoBlocoMeses: 2,
  blocos: [{ numero_bloco: 1, inicio: "2027-01-10", fim: fimInclusivoISO("2027-01-10", 60), meses: 2, valor: 6000, caucao: 3000, status: "ativo" }],
};
const HOJE = "2026-11-07";

function mudar(p: Parameters<typeof validarProposta>[1]) {
  const v = validarProposta(CONTRATO, p, HOJE);
  assert.ok(v.ok);
  return v.valor;
}

test("E672: remarcar a entrada (10/01 → 17/01) mostra saída, dias exatos, total e diferença zero", () => {
  const m = mudar({ inicio: "2027-01-17" });
  const c = comparativoDoAditivo(CONTRATO, m, HOJE);
  assert.deepEqual(c.antes, { entrada: "2027-01-10", saida: "2027-03-10", dias: 60, total: 6000 });
  assert.deepEqual(c.depois, { entrada: "2027-01-17", saida: "2027-03-17", dias: 60, total: 6000 });
  assert.equal(c.diferenca, 0);
  const resumo = resumoDasMudancas({ ...m, comparativo: c });
  assert.match(resumo, /Entrada: de 10\/01\/2027 para 17\/01\/2027/);
  assert.match(resumo, /Saída: de 10\/03\/2027 para 17\/03\/2027/);
  assert.match(resumo, /Dias: de 60 para 60/);
  assert.match(resumo, /Total: de R\$ 6\.000,00 para R\$ 6\.000,00/);
  assert.match(resumo, /Diferença: sem diferença a pagar ou devolver/);
});

test("E672: acrescentar um mês mostra 90 dias, novo total e a diferença a pagar", () => {
  const m = mudar({ meses: 3 });
  const c = comparativoDoAditivo(CONTRATO, m, HOJE);
  assert.equal(c.depois.dias, 90);
  assert.equal(c.depois.total, 9000);
  assert.equal(c.diferenca, 3000);
  assert.match(resumoDasMudancas({ ...m, comparativo: c }), /Diferença: R\$ 3\.000,00 a pagar a mais/);
});

test("E672: tirar um mês mostra a diferença a devolver", () => {
  const base: ContratoParaAditivo = { ...CONTRATO, blocos: [{ ...CONTRATO.blocos[0], meses: 3, valor: 9000, fim: fimInclusivoISO("2027-01-10", 90) }] };
  const v = validarProposta(base, { meses: 2 }, HOJE);
  assert.ok(v.ok);
  const c = comparativoDoAditivo(base, v.valor, HOJE);
  assert.equal(c.diferenca, -3000);
  assert.match(resumoDasMudancas({ ...v.valor, comparativo: c }), /Diferença: R\$ 3\.000,00 a devolver/);
});

test("E672: o motivo entra no resumo e no texto assinado, junto do comparativo", () => {
  const m = mudar({ inicio: "2027-01-17" });
  const c = comparativoDoAditivo(CONTRATO, m, HOJE);
  const completo = { ...m, comparativo: c, motivo: "Meu voo foi remarcado" };
  assert.match(resumoDasMudancas(completo), /Motivo: Meu voo foi remarcado/);
  const doc = linhasDoAditivo({ numeroContrato: "VN-CT-X", numero: 1, mudancas: completo, propostoEm: "2026-11-07" }).join("\n");
  assert.match(doc, /Saída: de 10\/03\/2027 para 17\/03\/2027/);
  assert.match(doc, /Motivo: Meu voo foi remarcado/);
});

test("E672: aditivo antigo (sem comparativo) segue com o mesmo texto de antes", () => {
  assert.equal(resumoDasMudancas({ inicio: { antes: "2027-01-10", depois: "2027-01-17" } }), "Entrada: de 10/01/2027 para 17/01/2027");
});

test("E672: a ação grava o comparativo e o motivo, e o formulário pede o motivo e mostra a saída", () => {
  const acao = readFileSync(new URL("../data/estadia-actions.ts", import.meta.url), "utf8");
  assert.match(acao, /comparativoDoAditivo\(/);
  assert.match(acao, /motivo/);
  const tela = readFileSync(new URL("../../app/(dashboard)/dashboard/estadia/[contratoId]/alteracao/alteracao-tela.tsx", import.meta.url), "utf8");
  assert.match(tela, /data-testid="alteracao-motivo"/);
  assert.match(tela, /data-testid="alteracao-saida"/);
});
