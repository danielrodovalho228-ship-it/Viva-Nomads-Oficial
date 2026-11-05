/*
  E601 (reprova final do E562, 05/11): o formulário do dono mostrava a caução (50% do proporcional de 43 dias), mas
  nenhum valor de caução aparecia para a moradora na proposta. Agora as duas telas leem a mesma função.
  Roda: node --test src/lib/propostas/e601-caucao-na-proposta.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { caucaoDaProposta } from "./caucao-da-proposta.ts";
import { resumoContratoEmDias } from "../contrato-blocos.ts";

test("E601: 43 dias a R$ 2.800 → caução de 50% do bloco proporcional (a mesma do contrato)", () => {
  const c = caucaoDaProposta({ meses: 2, dias: 43 }, 2800);
  assert.ok(c);
  assert.equal(c.dias, 43);
  assert.equal(c.valor, resumoContratoEmDias(43, 2800, 0.1).blocos[0].caucao);
  assert.ok(Math.abs(c.valor - (2800 * 43) / 30 / 2) < 0.6);
});

test("E601: a caução não depende da taxa de serviço", () => {
  assert.equal(caucaoDaProposta({ meses: 2, dias: 43 }, 2800)?.valor, resumoContratoEmDias(43, 2800, 0.15).blocos[0].caucao);
});

test("E601: estadia longa → caução do 1º bloco (até 90 dias)", () => {
  const c = caucaoDaProposta({ meses: 4, dias: 120 }, 3000);
  assert.ok(c);
  assert.equal(c.dias, resumoContratoEmDias(120, 3000, 0).blocos[0].dias ?? resumoContratoEmDias(120, 3000, 0).blocos[0].meses * 30);
});

test("E601: sem valor mensal não há caução", () => {
  assert.equal(caucaoDaProposta({ meses: 2, dias: 43 }, 0), null);
});

const ler = (rel: string) => readFileSync(new URL(rel, import.meta.url), "utf8");

test("E601: a proposta recebida mostra a caução pela mesma função do formulário do dono", () => {
  const detalhe = ler("../../app/(dashboard)/dashboard/propostas/[id]/proposta-detalhe.tsx");
  const valores = detalhe.slice(detalhe.indexOf("function Valores"), detalhe.indexOf("export function PropostaDetalhe"));
  assert.match(valores, /<LinhaCaucao v=\{v\} \/>/);
  const linha = detalhe.slice(detalhe.indexOf("function LinhaCaucao"), detalhe.indexOf("function Valores"));
  assert.match(linha, /caucaoDaProposta\(v\.termos, v\.totais\.valorMensal\)/);
  assert.match(linha, /data-testid="proposta-caucao"/);
  const montagem = ler("../../app/(dashboard)/dashboard/orcamentos/nova/montagem-proposta.tsx");
  assert.match(montagem, /caucaoDaProposta\(/);
});
