/**
 * E467 (PC11): o rodapé seguia oferecendo "Entrar ou cadastrar" para quem já está logado (o cabeçalho, ao lado, dizia
 * "Meu painel"). Agora o link de entrar é do componente de navegador que lê a sessão, com a mesma regra do cabeçalho
 * (só depois de montar e com usuário): logado, some; deslogado, fica. `npm test`.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const ler = (p: string) => readFileSync(new URL(p, import.meta.url), "utf8");

test("o rodapé não escreve mais 'Entrar ou cadastrar' fixo: usa o link que conhece a sessão", () => {
  const f = ler("./footer.tsx");
  assert.doesNotMatch(f, /<FooterLink href="\/auth">Entrar ou cadastrar<\/FooterLink>/);
  assert.match(f, /<EntrarNoRodape \/>/);
});

test("o link some para quem está logado (mesma regra do cabeçalho: montado e com usuário)", () => {
  const c = ler("./entrar-no-rodape.tsx");
  assert.match(c, /^"use client";/);
  assert.match(c, /const logado = useMontado\(\) && !!user;/);
  assert.match(c, /if \(logado\) return null;/);
  assert.match(c, />\s*Entrar ou cadastrar\s*</);
});
