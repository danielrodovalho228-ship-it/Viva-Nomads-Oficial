/*
  E233-A — fim do limite de anúncios do modelo antigo. Os planos com mensalidade são HISTÓRICO (config/planos.ts):
  `limiteAnuncios` / LIMITE_ANUNCIOS ficam lá como dado, sem nenhum leitor. Publicar, sair de rascunho, reativar e a
  prontidão dependem só dos requisitos reais; nenhuma tela diz "seu plano permite" nem "mude de plano".
  Roda: node --test src/lib/planos/sem-limite-anuncios.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const RAIZ = new URL("../../../", import.meta.url).pathname;

function arquivos(dir: string): string[] {
  const out: string[] = [];
  for (const n of readdirSync(join(RAIZ, dir))) {
    const p = join(dir, n);
    if (statSync(join(RAIZ, p)).isDirectory()) out.push(...arquivos(p));
    else if (/\.(ts|tsx)$/.test(n)) out.push(p);
  }
  return out;
}

const CODIGO = [...arquivos("src"), ...arquivos("tests")].filter((p) => p !== "src/config/planos.ts" && p !== relative(RAIZ, new URL(import.meta.url).pathname));

test("ninguém lê o limite de anúncios fora de config/planos.ts", () => {
  const leitores = CODIGO.filter((p) => /\bLIMITE_ANUNCIOS\b|\.limiteAnuncios\b|\bLISTING_LIMIT\b|\blistingLimit\b/.test(readFileSync(join(RAIZ, p), "utf8")));
  assert.deepEqual(leitores, []);
});

test("as travas do modelo antigo não existem mais", () => {
  const travas = CODIGO.filter((p) => !p.endsWith(".test.ts")).filter((p) =>
    /\b(situacaoDoLimite|limiteDePublicacao|limiteDoPlano|situacaoComLimite|minhaSituacaoLimite|textoVagaNoPlano|limitePlanoOk|BlocoLimite)\b/.test(readFileSync(join(RAIZ, p), "utf8")),
  );
  assert.deepEqual(travas, []);
});

test("nenhum texto do app manda mudar de plano por limite de anúncios", () => {
  const app = CODIGO.filter((p) => p.startsWith("src/") && !p.endsWith(".test.ts"));
  const com = app.filter((p) => /seu plano permite|mude de plano|mudar de plano|vaga no seu plano/i.test(readFileSync(join(RAIZ, p), "utf8")));
  assert.deepEqual(com, []);
});
