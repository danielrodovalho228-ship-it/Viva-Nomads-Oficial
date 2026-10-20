import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const src = readFileSync(new URL("./visita-video.tsx", import.meta.url), "utf8");

test("t168: a janela do pedido de visita sai do cartão de preço (portal no body), senão a barra fixa do celular tapa o botão 'Pedir visita'", () => {
  assert.match(src, /import \{ createPortal \} from "react-dom"/);
  assert.match(src, /aberto && createPortal\(/);
  assert.match(src, /document\.body/);
});

test("t168: o botão de enviar e o de abrir mantêm os data-testid do laboratório", () => {
  // Prompt 23: vídeo e presencial usam o mesmo pedido; o prefixo da visita por vídeo continua "visita-video".
  assert.match(src, /prefixo: "visita-video"/);
  assert.match(src, /data-testid=\{`\$\{t\.prefixo\}-enviar`\}/);
  assert.match(src, /modalidade === "video" \? "visita-video-abrir" : "agendar-visita"/);
});
