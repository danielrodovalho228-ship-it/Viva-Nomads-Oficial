/*
  Auditoria de erros e estados vazios — achado 159. Cadastro/edição do imóvel › "O imóvel tem estrutura de acessibilidade?":
  a falha ao LER o checklist salvo virava `{}` (checklist vazio) e a tela seguia editável — marcar um item gravava SÓ esse item e
  apagava o que estava salvo. E se a chamada ao servidor falhasse de vez, a seção sumia (carregado nunca virava true).
  Agora a falha mostra "Não foi possível carregar…" com "Tentar de novo" e NÃO libera a edição.
  Roda: node --test src/lib/data/achado159-estrutura-leitura.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const src = readFileSync(new URL("../../components/anuncio/estrutura-acessibilidade.tsx", import.meta.url), "utf8");

test("a falha de leitura não vira checklist vazio editável", () => {
  assert.doesNotMatch(src, /const c = r\.ok \? r\.checklist : \{\};/);
  assert.match(src, /if \(!r\.ok\) \{\s*setFalhaCarga\(true\);/);
});

test("a chamada que falha de vez também mostra o erro (não some a seção)", () => {
  assert.match(src, /\.catch\(\(\) => \{\s*if \(vivo\) setFalhaCarga\(true\);/);
});

test("com falha, a tela diz o que houve e oferece 'Tentar de novo' em vez de liberar a edição", () => {
  assert.match(src, /data-testid="estrutura-falha-carga"/);
  assert.match(src, /Tentar de novo/);
  const falha = src.indexOf("if (falhaCarga)");
  assert.ok(falha > 0 && falha < src.indexOf("if (!carregado) return null;"), "a falha vem antes do 'carregando'");
});
