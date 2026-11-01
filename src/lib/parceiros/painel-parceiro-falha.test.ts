/*
  Auditoria de erros e estados vazios — achado nº 15: no Painel do parceiro, uma falha do banco na leitura do cadastro
  virava "ainda não é parceiro" (a tela mostrava o formulário de pedido de parceria a quem já é parceiro), e a falha dos
  serviços, da galeria ou da agenda virava "nenhum serviço". Agora a tela pede com `exigir`: a falha lança e o painel
  mostra "Não conseguimos abrir esta tela" com "Tentar de novo".
  Roda: node --test src/lib/parceiros/painel-parceiro-falha.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const ler = (p: string) => readFileSync(new URL(`../../../${p}`, import.meta.url), "utf8");

test("com exigir, a falha do cadastro e das listas do parceiro lança", () => {
  const src = ler("src/lib/parceiros/painel-actions.ts");
  assert.match(src, /async function meu\(opcoes: \{ exigir\?: boolean \} = \{\}\)/);
  assert.match(src, /if \(error && opcoes\.exigir\) throw new Error\(MSG_PAINEL_PARCEIRO_NAO_CARREGOU\);\n\s*return p \?/);
  assert.match(src, /export async function meuPainelParceiro\(opcoes: \{ exigir\?: boolean \} = \{\}\)[^{]*\{\n\s*const m = await meu\(opcoes\);/);
  assert.match(src, /if \(\(e1 \|\| e2 \|\| e3\) && opcoes\.exigir\) throw new Error\(MSG_PAINEL_PARCEIRO_NAO_CARREGOU\);/);
});

test("a tela do painel pede com exigir; a recarga dentro da tela segue com .catch", () => {
  assert.match(ler("src/app/(dashboard)/dashboard/parceiro/page.tsx"), /await meuPainelParceiro\(\{ exigir: true \}\)/);
  assert.match(ler("src/app/(dashboard)/dashboard/parceiro/painel-parceiro.tsx"), /meuPainelParceiro\(\)\.catch\(\(\) => null\)/);
});
