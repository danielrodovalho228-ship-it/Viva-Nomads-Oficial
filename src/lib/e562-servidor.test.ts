/*
  E562 (E-DIAS) — o caminho do servidor: candidatura → proposta → contrato em DIAS (sem Math.ceil para meses).
  Roda: node --test src/lib/e562-servidor.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const ler = (p: string) => readFileSync(p, "utf8");
const acoes = ler("src/lib/data/propostas-actions.ts");
const servidor = ler("src/lib/data/propostas-servidor.ts");
const contrato = ler("src/lib/data/actions.ts");
const reg = contrato.slice(contrato.indexOf("export async function registrarContrato"), contrato.indexOf("const LEAD_LIMITE_HORA"));

test("a montagem abre com os dias da candidatura (entrada → saída), dentro do prazo do anúncio", () => {
  assert.match(acoes, /select\("id, owner_id, tenant_id, property_id, status, inicio_desejado, fim_desejado"\)/);
  assert.match(acoes, /termosDoAnuncio\(im, diasDaMontagem\(desejada, \(lead\.fim_desejado as string \| null\) \?\? null, lim\)/);
  const fn = acoes.slice(acoes.indexOf("function diasDaMontagem("), acoes.indexOf("export interface EntradaProposta"));
  assert.match(fn, /periodoDaCandidatura\(entrada, saida\)/);
  assert.match(fn, /p \? p\.dias : 120/);
  assert.doesNotMatch(fn, /Math\.ceil|\.meses/);
});

test("o envio grava os dias (tela antiga: meses × 30) e a versão leva meses como referência derivada", () => {
  // Asserção alterada (E1116, ORDEM-DUET-503): o 30 vem da regra única (DIAS_POR_MES); a conta é a mesma.
  assert.match(acoes, /const dias = e\.dias != null && Number\.isFinite\(Number\(e\.dias\)\) \? Number\(e\.dias\) : Math\.round\(num\(e\.meses\)\) \* DIAS_POR_MES;/);
  assert.match(servidor, /meses: mesesDeReferencia\(dias\),\n\s*dias,/);
  assert.match(servidor, /limpezas_pacote: t\.limpezasPacote \?\? null,/);
  // Asserção alterada (E1116): idem, DIAS_POR_MES em vez do 30 à mão.
  assert.match(servidor, /dias: v\.dias == null \? Number\(v\.meses\) \* DIAS_POR_MES : Number\(v\.dias\)/);
});

test("o contrato nasce com os dias da proposta aceita: prazo_total_dias e blocos de até 90 dias em dias", () => {
  assert.match(reg, /diasExatos != null \? !diasValidos\(diasExatos\)/);
  assert.match(reg, /const resumo = diasExatos != null \? resumoContratoEmDias\(diasExatos, aluguel, rate, tamanho\) : resumoContrato\(prazo, aluguel, rate, tamanho\);/);
  assert.match(reg, /prazo_total_dias: resumo\.prazoTotalDias,/);
  assert.doesNotMatch(reg, /prazoTotalMeses \* DIAS_POR_MES/);
});
