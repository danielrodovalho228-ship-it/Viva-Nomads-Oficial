import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const ler = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");

test("4f8d17c6: o botão flutuante da Viva aparece também na /buscar (mesmo comportamento em todas as páginas)", () => {
  const src = ler("components/ajuda/viva-chat.tsx");
  const linha = src.split("\n").find((l) => l.includes("const ESCONDER")) ?? "";
  assert.doesNotMatch(linha, /"\/buscar"/);
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

test("4f8d17c6: o flutuante é o botão primário do site (mesmos tokens), ícone + texto em qualquer largura; sobe em vez de sumir", () => {
  const src = ler("components/ajuda/viva-chat.tsx");
  assert.match(src, /className=\{buttonClasses\(\)\}/);
  assert.doesNotMatch(src, /h-12 w-12/);
  assert.doesNotMatch(src, /rounded-full bg-forest/);
  assert.doesNotMatch(src, /hidden md:inline/);
  assert.match(src, /elevacaoDoFlutuante/);
  assert.doesNotMatch(src, /cruzaCantoDoFlutuante/);
  // some só com campo em foco (teclado do celular)
  assert.match(src, /focusin/);
  assert.match(src, /max-md:hidden/);
  assert.match(ler("app/globals.css"), /html:not\(\[data-app\]\) body:has\(\[data-testid="fale-com-a-viva-raiz"\]\)\s*\{\s*padding-bottom: 4\.5rem/);
  assert.match(ler("components/ui/button.tsx"), /data-cta=/);
});

test("t16: o botão flutuante some nas boas-vindas do app (tela de 100dvh: cobria 'Quero anunciar' e fazia a tela rolar)", () => {
  const src = ler("components/ajuda/viva-chat.tsx");
  const linha = src.split("\n").find((l) => l.includes("const ESCONDER")) ?? "";
  assert.match(linha, /"\/app\/boas-vindas"/);
  // caso negativo: as demais telas do site continuam com o botão
  assert.doesNotMatch(linha, /"\/app"[,\]]/);
  assert.doesNotMatch(linha, /"\/"[,\]]/);
});
