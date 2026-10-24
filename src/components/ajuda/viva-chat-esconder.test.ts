import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const ler = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");

test("E95: a bolha flutuante da Viva não aparece na /buscar (não cobre os cards; a ajuda fica como link na página)", () => {
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

test("4f8d17c6: o flutuante é o botão primário do site (mesmos tokens), ícone + texto em qualquer largura", () => {
  const src = ler("components/ajuda/viva-chat.tsx");
  assert.match(src, /cn\(buttonClasses\(\), /);
  assert.doesNotMatch(src, /h-12 w-12/);
  assert.doesNotMatch(src, /rounded-full bg-forest/);
  assert.doesNotMatch(src, /hidden md:inline/);
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

test("a9982623: o flutuante é arrastável e NÃO recalcula a posição em scroll/re-render (fim do pulo)", () => {
  const src = ler("components/ajuda/viva-chat.tsx");
  assert.doesNotMatch(src, /elevacaoDoFlutuante/);
  assert.doesNotMatch(src, /addEventListener\("scroll"/);
  assert.doesNotMatch(src, /MutationObserver/);
  assert.match(src, /setPointerCapture/);
  assert.match(src, /gravarPosicao/);
  assert.match(src, /lerPosicao/);
  // clique logo após arraste não abre o chat; tecla Enter/Espaço continua abrindo (botão nativo)
  assert.match(src, /gesto\.current\?\.arrastou/);
  assert.match(src, /<button\s[^>]*type="button"/);
  assert.match(src, /print:hidden/);
  const css = ler("app/globals.css");
  assert.match(css, /\.vn-viva-flut\s*\{/);
  assert.match(css, /body:has\(\[data-testid="imovel-largura-total"\]\)/);
});

test("t182: o botão flutuante some em Mensagens (tampava o 'Enviar' da conversa no computador)", () => {
  const src = ler("components/ajuda/viva-chat.tsx");
  const linha = src.split("\n").find((l) => l.includes("const ESCONDER")) ?? "";
  assert.match(linha, /"\/dashboard\/mensagens"/);
  // caso negativo: o painel em geral continua com o botão
  assert.doesNotMatch(linha, /"\/dashboard"[,\]]/);
});
