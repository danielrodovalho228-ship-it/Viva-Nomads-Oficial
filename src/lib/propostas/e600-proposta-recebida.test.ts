/*
  E600 (reprova final do E562, 05/11): a página da proposta recebida mostrava "Total do contrato R$ 4.672" (arredondado,
  ao lado da conta "= R$ 4.671,67"), o rótulo "Meses 2" (o desenho é em DIAS) e não mostrava a data de saída.
  Roda: node --test src/lib/propostas/e600-proposta-recebida.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { estadiaDaProposta } from "./estadia-da-proposta.ts";
import { formatBRLExato } from "../precos.ts";

const nbsp = (s: string) => s.replace(/ /g, " ");

test("E600: a estadia da proposta em dias, com a data de saída (entrada + dias)", () => {
  const e = estadiaDaProposta({ dataEntrada: "2027-01-10", meses: 2, dias: 43 });
  assert.equal(e.dias, 43);
  assert.equal(e.rotulo, "43 dias (1 mês + 13 dias)");
  assert.equal(e.saida, "2027-02-22");
});

test("E600: proposta antiga sem dias usa meses × 30", () => {
  const e = estadiaDaProposta({ dataEntrada: "2026-12-01", meses: 2 });
  assert.equal(e.dias, 60);
  assert.equal(e.rotulo, "60 dias (2 meses)");
  assert.equal(e.saida, "2027-01-30");
});

test("E600: o total com centavos não é arredondado", () => {
  assert.equal(nbsp(formatBRLExato(4671.67)), "R$ 4.671,67");
  assert.equal(nbsp(formatBRLExato(3050)), "R$ 3.050");
});

test("E600: a página mostra estadia em dias, a saída e os totais exatos", () => {
  const fonte = readFileSync(new URL("../../app/(dashboard)/dashboard/propostas/[id]/proposta-detalhe.tsx", import.meta.url), "utf8");
  const valores = fonte.slice(fonte.indexOf("function Valores"), fonte.indexOf("export function PropostaDetalhe"));
  assert.doesNotMatch(valores, /rotulo="Meses"/);
  assert.match(valores, /rotulo="Estadia"/);
  assert.match(valores, /rotulo="Saída"/);
  assert.match(valores, /ROTULO_TOTAL_CONTRATO\} valor=\{formatBRLExato\(/);
  assert.doesNotMatch(valores, /ROTULO_TOTAL_CONTRATO\} valor=\{formatBRL\(/);
});
