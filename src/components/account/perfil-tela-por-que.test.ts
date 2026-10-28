/*
  L-70: o cartão "Por que estou na cidade" precisa estar montado na tela Perfil (modo inquilino).
  Roda: node --test src/components/account/perfil-tela-por-que.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const TELA = readFileSync(new URL("./perfil-tela.tsx", import.meta.url), "utf8");

test("Perfil monta <PorQueNaCidade /> dentro do bloco do inquilino", () => {
  assert.match(TELA, /import \{ PorQueNaCidade \} from "@\/components\/account\/por-que-na-cidade"/);
  const bloco = TELA.slice(TELA.indexOf("{mostraPainelMorador && ("));
  const fim = bloco.indexOf("</Panel>");
  assert.match(bloco.slice(0, fim), /<PorQueNaCidade \/>/);
});

test("E192: o painel do morador vale para quem tem cadastro de morador em qualquer modo (não só no modo morador)", () => {
  assert.match(TELA, /const cadastroMorador = useAuthStore\(\(s\) => s\.user\?\.role === "tenant"\);/);
  assert.match(TELA, /const mostraPainelMorador = mode === "tenant" \|\| cadastroMorador;/);
  assert.doesNotMatch(TELA, /\{mode === "tenant" && \(\s*<Panel/);
});
