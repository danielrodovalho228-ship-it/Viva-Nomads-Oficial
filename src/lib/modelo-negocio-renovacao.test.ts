/*
  Ordem 02d4c903, F35 (texto): o Fechamento e "Contratos & blocos" (/modelodenegocio) leem a regra da
  renovação da MESMA constante (TEXTO_RENOVACAO_COMISSAO, src/lib/cobranca/regra.ts). A regra de
  cobrança não muda; só deixa de haver duas frases diferentes.
  Roda: node --test src/lib/modelo-negocio-renovacao.test.ts
*/
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const tela = readFileSync("src/components/modelo-negocio/modelo-negocio.tsx", "utf8");

test("F35: modelo de negócio lê a constante única, sem frase própria sobre renovação", () => {
  assert.ok(tela.includes("{TEXTO_RENOVACAO_COMISSAO}"));
  assert.match(tela, /import \{[^}]*TEXTO_RENOVACAO_COMISSAO[^}]*\} from "@\/lib\/cobranca\/regra"/);
  assert.ok(!tela.includes("A renovação conta"));
  assert.ok(!tela.includes("cobrada uma única vez por contrato fechado"));
});
