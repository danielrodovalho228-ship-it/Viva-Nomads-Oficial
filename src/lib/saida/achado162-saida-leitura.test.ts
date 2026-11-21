/*
  Achado 162 — "Sair da Viva": (a) a falha de leitura das pendências virava "Você não tem pendências. Se quiser, pode apagar
  seus dados."; (b) pausar a conta dizia "Conta pausada" mesmo com a retirada dos anúncios/página falhando; (c) o admin via
  "Correção fechada"/"Estado atualizado" com a gravação falhando. Agora a falha é dita e a tela oferece "Tentar de novo".
  Roda: node --test src/lib/saida/achado162-saida-leitura.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const acoes = readFileSync(new URL("./acoes.ts", import.meta.url), "utf8");
const tela = readFileSync(new URL("../../components/account/sair-da-viva.tsx", import.meta.url), "utf8");

test("estadoSaida: qualquer leitura que falha LANÇA (nunca 'sem pendências')", () => {
  const fn = acoes.slice(acoes.indexOf("export async function estadoSaida("), acoes.indexOf("function revalidarConta("));
  assert.match(fn, /error: erroPerfil/);
  assert.match(fn, /error: erroComoMorador|comoMorador\.error/);
  assert.match(fn, /erroPedidos/);
  assert.match(fn, /throw new Error\(`estadoSaida: \$\{/);
  assert.match(fn, /erroCaucoes|erroEncerramentos/);
});

test("a tela não afirma 'sem pendências' quando a leitura falhou: mostra a falha com 'Tentar de novo'", () => {
  assert.match(tela, /data-testid="saida-falha-leitura"/);
  assert.match(tela, /Não conseguimos conferir as suas pendências agora\./);
  assert.match(tela, /data-testid="saida-tentar-de-novo"/);
  assert.match(tela, /\.catch\(\(\) => vivo && setFalhaLeitura\(true\)\)/);
  // O "sem pendências" só aparece com o estado lido.
  assert.match(tela, /\{estado && estado\.pendencias\.length > 0 \? \(/);
  assert.match(tela, /falhaLeitura \? \(/);
});

test("pausarConta confere a retirada dos anúncios e da página de parceiro antes de dizer 'Conta pausada'", () => {
  const fn = acoes.slice(acoes.indexOf("export async function pausarConta("), acoes.indexOf("/** Reativa em 1 toque"));
  assert.match(fn, /const \{ error: erroAnuncios \} = await s\.admin\.from\("properties"\)/);
  assert.match(fn, /const \{ error: erroParceiro \} = await s\.admin\.from\("parceiros"\)/);
  assert.match(fn, /if \(erroAnuncios \|\| erroParceiro\)/);
});

test("admin: fechar correção e mudar estado da denúncia confirmam a gravação", () => {
  const fechar = acoes.slice(acoes.indexOf("export async function adminFecharCorrecao("), acoes.indexOf("export async function adminEstadoDenuncia("));
  assert.match(fechar, /const \{ data: c, error: erroLeitura \}/);
  assert.match(fechar, /if \(erroLeitura\) return \{ ok: false, erro: "Não foi possível ler a correção agora\. Tente de novo\." \}/);
  assert.match(fechar, /const \{ error: erroFecha \} = await a\.admin\.from\("qualidade_correcoes"\)\.update/);
  const estado = acoes.slice(acoes.indexOf("export async function adminEstadoDenuncia("), acoes.indexOf("/** A denúncia que a própria pessoa fez"));
  assert.match(estado, /const \{ error: erroEstado \} = await a\.admin\.from\("denuncias_anuncio"\)\.update/);
  assert.match(estado, /if \(erroEstado\) return \{ ok: false, erro: "Não foi possível atualizar o estado agora\. Tente de novo\." \}/);
});
