import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const chat = readFileSync("src/components/ajuda/viva-chat.tsx", "utf8");
const detalhe = readFileSync("src/app/(public)/imoveis/[id]/property-detail.tsx", "utf8");

// E709: a 1280 px o "Fale com a Viva" (180 × 48 px, com texto) ficava sobre o local e o título do anúncio.
// Na página do imóvel ele é o botão redondo (48 px, só o ícone) em TODAS as larguras, e a página reserva a faixa
// da esquerda onde ele mora — o botão nunca senta sobre o texto, e o acesso rápido ao contato continua.
test("na página do imóvel o botão é redondo também no computador (sem o texto na frente do conteúdo)", () => {
  assert.doesNotMatch(chat, /max-lg:h-12 max-lg:w-12/);
  assert.doesNotMatch(chat, /"max-lg:sr-only"/);
  assert.match(chat, /compacto && !aberto && "w-12 rounded-full px-0/);
  assert.match(chat, /compacto && !aberto \? "sr-only"/);
});

test("a página do imóvel reserva a faixa do botão no computador (dos dois lados, mesma margem)", () => {
  const linha = detalhe.split("\n").find((l) => l.includes('data-testid="imovel-largura-total"')) ?? "";
  assert.match(linha, /lg:px-\(--faixa-flutuante\)/);
});
