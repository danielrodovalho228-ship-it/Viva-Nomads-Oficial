import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const chat = readFileSync("src/components/ajuda/viva-chat.tsx", "utf8");
const css = readFileSync("src/app/globals.css", "utf8");

// C1b (QA, 07/11) + decisão do Muse: o "Fale com a Viva" nunca cobre conteúdo. Nas páginas públicas (termos,
// privacidade, empresas, parceiros…) o botão de 180 × 48 px cobria texto ao rolar. Agora ele é o redondo (48 px, nome
// acessível mantido) em todo o site e o conteúdo da página pública reserva a faixa da direita a partir de 768 px.
test("o botão é redondo em todo o site (não só no anúncio e no painel)", () => {
  assert.match(chat, /const compacto = true;/);
});

test("o conteúdo do site público reserva a faixa onde o botão mora (de 768 px em diante)", () => {
  const regra = css.slice(css.indexOf(".vn-main .container-page"), css.indexOf(".vn-main .container-page") + 400);
  assert.match(css, /@media \(min-width: 768px\)[\s\S]{0,200}\.vn-main \.container-page/);
  assert.match(regra, /padding-right: max\(/);
  assert.match(regra, /--faixa-flutuante/);
});
