/*
  Estados vazios (painel de desempenho do anúncio): a leitura dos imóveis parecidos e dos eventos deles ignorava o erro.
  Uma falha virava "0 imóveis no grupo" ou, pior, medianas calculadas com zeros ("Parecidos (mediana): 0", e o anúncio
  parecendo acima dos outros). Agora a falha marca a comparação como indisponível: sem medianas e com a frase de que
  não deu para comparar agora.
  Roda: node --test src/lib/data/desempenho-comparacao-falha.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const dados = readFileSync("src/lib/data/desempenho-anuncio.ts", "utf8");
const tela = readFileSync("src/app/(dashboard)/dashboard/imoveis/[id]/desempenho/page.tsx", "utf8");

test("a leitura dos parecidos e dos eventos deles confere o erro; falha → comparação indisponível (parecidos null, sem medianas)", () => {
  assert.match(dados, /const \{ data: candidatos, error: erroCandidatos \} = await admin/);
  assert.match(dados, /const \{ data: evsGrupo, error: erroGrupo \} = await admin/);
  assert.match(dados, /if \(erroCandidatos\) comparacaoIndisponivel = true;/);
  assert.match(dados, /if \(erroGrupo\) \{\s*comparacaoIndisponivel = true;/);
  assert.match(dados, /parecidos: comparacaoIndisponivel \? null : nParecidos,/);
  assert.match(dados, /medianas: comparacaoIndisponivel \? \{\} : medianas/);
  assert.match(dados, /parecidos: number \| null;/);
});

test("a tela diz que não comparou (nunca '0 imóveis no grupo' por falha)", () => {
  assert.match(tela, /p\.parecidos === null \? TEXTO_COMPARACAO_INDISPONIVEL/);
  assert.match(tela, /const TEXTO_COMPARACAO_INDISPONIVEL = "Não conseguimos comparar com os imóveis parecidos agora\. Tente de novo em instantes\.";/);
});
