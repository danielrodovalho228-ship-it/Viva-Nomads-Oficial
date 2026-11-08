import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const pagina = readFileSync("src/app/(public)/seguranca/page.tsx", "utf8");

// C10 (QA, 07/11): o mockup publico-seguranca traz a faixa "Desconfie de quem pede pagamento fora da plataforma" com o
// botão "Fale com a Viva"; o real listava os golpes sem ação para avisar a Viva.
test("/seguranca tem a faixa 'Desconfie…' com o botão Fale com a Viva (página própria do atendimento)", () => {
  assert.match(pagina, /data-testid="seguranca-avise"/);
  // Mockup publico-seguranca (conferido em origin/mockups): UMA linha "…fora da plataforma e avise a Viva.", ícone de aviso
  // à esquerda, contorno verde e o botão cheio "Fale com a Viva" à direita.
  assert.match(pagina, /Desconfie de quem pede pagamento fora da plataforma e avise a Viva\./);
  assert.match(pagina, /border border-forest/);
  assert.match(pagina, /<Info className=/);
  assert.match(pagina, /href=\{HREF_FALE_COM_A_VIVA\}[^>]*data-testid="seguranca-fale-com-a-viva"/);
  assert.match(pagina, /import \{ HREF_FALE_COM_A_VIVA \} from "@\/lib\/ajuda\/rotas"/);
});

test("a faixa vem depois dos golpes e antes das perguntas frequentes", () => {
  const i = pagina.indexOf('data-testid="seguranca-avise"');
  assert.ok(i > pagina.indexOf("GOLPES.map") && i < pagina.indexOf("Perguntas frequentes"));
});
