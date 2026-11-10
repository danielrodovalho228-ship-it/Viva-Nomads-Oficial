/* Roda: node --test src/components/account/e789-perfil-carregamento.test.ts — E789: Conta/Perfil abre com uma leitura só e esqueleto com a forma da tela. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const tela = readFileSync("src/components/account/perfil-tela.tsx", "utf8");
const acoes = readFileSync("src/lib/data/perfil-actions.ts", "utf8");

test("a tela pede perfil e dados numa Server Action só (um vai-e-volta, não dois enfileirados)", () => {
  assert.match(tela, /getPerfilInicial\(\)/);
  assert.doesNotMatch(tela, /Promise\.all\(\[getMeuPerfilPublico\(\), getMeusDados\(\)\]\)/);
});
test("getPerfilInicial roda as duas leituras em paralelo no servidor e deixa a falha lançar", () => {
  const f = acoes.slice(acoes.indexOf("export async function getPerfilInicial"));
  assert.match(f, /Promise\.all\(\[getMeuPerfilPublico\(\), getMeusDados\(\)\]\)/);
  assert.doesNotMatch(f.slice(0, f.indexOf("\n}\n")), /catch/);
});
test("a falha de leitura segue com 'Tentar de novo' (achados 66 e 70)", () => {
  assert.match(tela, /setLeituraFalhou\(true\)/);
  assert.match(tela, /perfil-leitura-tentar/);
});
test("o esqueleto tem a forma da tela (formulário e espelho), pulsa e avisa 'Carregando' — não são dois cartões vazios", () => {
  const e = tela.slice(tela.indexOf("function EsqueletoPerfil"), tela.indexOf("/** Extra do E62"));
  assert.match(e, /animate-pulse/);
  assert.match(e, /perfil-carregando-formulario/);
  assert.match(e, /perfil-carregando-espelho/);
  assert.match(e, /Carregando o seu perfil/);
  assert.doesNotMatch(e, /<div className="h-96 rounded-xl bg-white" \/>/);
  assert.match(e, /data-testid="perfil-carregando"/);
});
