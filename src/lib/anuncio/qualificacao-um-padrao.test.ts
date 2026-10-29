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

test("Passo 5: as comodidades (várias escolhas) são pílulas — E193, lista-master de 29/10", () => {
  const passo5 = readFileSync("src/app/(dashboard)/dashboard/imoveis/novo/etapa-encontramos.tsx", "utf8");
  const grupo = passo5.slice(passo5.indexOf("function GrupoComodidades"), passo5.indexOf("function AvisoBairro"));
  assert.match(grupo, /<Pilula\s+key=\{it\.key\}\s+papel="pressed"/);
  assert.match(grupo, /flex flex-wrap gap-2/);
  assert.doesNotMatch(grupo, /data-cartao-assistente|rounded-xl border-2/);
});
