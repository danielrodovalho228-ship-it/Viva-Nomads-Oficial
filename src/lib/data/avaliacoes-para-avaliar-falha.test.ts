/*
  Auditoria de erros e estados vazios (rodada 5) — a aba "Para avaliar" do painel Avaliações lia as estadias e os
  contratos SEM `exigir`: uma falha do banco virava lista vazia e a tela dizia "Nada para avaliar agora" — quem estava
  dentro dos 14 dias para avaliar a outra parte achava que não tinha nada a fazer e perdia a janela. Agora a aba pede
  com `exigir`: a falha lança e o painel mostra "Não conseguimos abrir esta tela" com "Tentar de novo" (o mesmo das
  abas "Recebidas" e "Feitas", achado nº 9).
  Roda: node --test src/lib/data/avaliacoes-para-avaliar-falha.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const ler = (p: string) => readFileSync(new URL(`../../../${p}`, import.meta.url), "utf8");

test("'Para avaliar' lê estadias e contratos com exigir (a falha não vira 'Nada para avaliar agora')", () => {
  const src = ler("src/lib/data/avaliacoes-painel.ts");
  const bloco = src.slice(src.indexOf("export async function avaliacoesParaFazer"));
  assert.match(bloco, /getMinhasLocacoes\(\{ exigir: true \}\)/);
  assert.match(bloco, /getMeusContratos\(\{ exigir: true \}\)/);
});

test("as duas leituras lançam na falha quando pedem com exigir", () => {
  const src = ler("src/lib/data/contratos-actions.ts");
  assert.match(src, /if \(error && opcoes\.exigir\) throw new Error\(MSG_LOCACOES_NAO_CARREGARAM\);/);
  assert.match(src, /if \(error && opcoes\.exigir\) throw new Error\(MSG_CONTRATOS_NAO_CARREGARAM\);/);
  // getMeusContratos repassa o exigir para a lista de imóveis (a 1ª leitura): sem ela, o "nenhum imóvel" também mentia.
  assert.match(src, /const props = await listMyProperties\(\{ exigir: opcoes\.exigir \}\);/);
});

test("a tela do painel continua pedindo as três abas (recebidas e feitas com exigir)", () => {
  const page = ler("src/app/(dashboard)/dashboard/avaliacoes/page.tsx");
  assert.match(page, /avaliacoesRecebidas\(\{ exigir: true \}\), avaliacoesFeitas\(\{ exigir: true \}\)/);
  assert.match(page, /await avaliacoesParaFazer\(/);
});
