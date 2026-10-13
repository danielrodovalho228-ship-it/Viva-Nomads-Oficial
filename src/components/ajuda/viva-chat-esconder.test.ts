import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const ler = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");

test("F3: o botão flutuante da Viva não aparece em /buscar (cobria 'Mais filtros')", () => {
  const src = ler("components/ajuda/viva-chat.tsx");
  const linha = src.split("\n").find((l) => l.includes("const ESCONDER")) ?? "";
  assert.match(linha, /"\/buscar"/);
});

test("F3: /buscar mantém a ajuda como link na página", () => {
  const src = ler("app/(public)/buscar/search-client.tsx");
  assert.match(src, /data-testid="buscar-ajuda"/);
  assert.match(src, /href="\/ajuda"/);
});

test("t58: o botão flutuante some em Conta → Segurança (cobria 'Nova senha' e os botões do 2FA)", () => {
  const src = ler("components/ajuda/viva-chat.tsx");
  const linha = src.split("\n").find((l) => l.includes("const ESCONDER")) ?? "";
  assert.match(linha, /"\/dashboard\/conta\/seguranca"/);
  // caso negativo: as outras telas da conta continuam com o botão
  assert.doesNotMatch(linha, /"\/dashboard\/conta"[,\]]/);
});
