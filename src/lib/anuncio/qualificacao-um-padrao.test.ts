/* Roda: node --test src/lib/anuncio/qualificacao-um-padrao.test.ts — E193 (um padrão só de controle na qualificação). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const TELA = readFileSync("src/app/(dashboard)/dashboard/imoveis/novo/qualificacao.tsx", "utf8");

test("sem interruptor nem chip: sim/não, opções e 'Não tem internet' usam o mesmo CartaoOpcao", () => {
  assert.doesNotMatch(TELA, /<Switch\b|from "@\/components\/ui\/switch"/);
  assert.match(TELA, /rotulo="Sim, tem"/);
  assert.match(TELA, /rotulo="Não tem"/);
  assert.match(TELA, /<CartaoOpcao on=\{sem\}[\s\S]{0,160}?rotulo="Não tem internet"/);
  // Os cartões de opção também passam pelo mesmo componente.
  assert.match(TELA, /\{q\.opcoes\.map\(\(o\) => \(\s*<CartaoOpcao/);
});
