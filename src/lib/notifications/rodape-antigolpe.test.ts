import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { AVISO_ANTIGOLPE, rodapeAntigolpeHtml } from "./aviso-antigolpe.ts";

test("rodapé antigolpe: aviso, link para /seguranca e aviso de fase de testes", () => {
  const html = rodapeAntigolpeHtml("https://vivanomads.com.br");
  assert.match(AVISO_ANTIGOLPE, /nunca pede Pix, senha ou código por WhatsApp ou SMS\./);
  assert.match(AVISO_ANTIGOLPE, /Pagamentos só pelo que está no contrato\./);
  assert.ok(html.includes(AVISO_ANTIGOLPE));
  assert.ok(html.includes('href="https://vivanomads.com.br/seguranca"'));
  assert.ok(html.includes("Plataforma em fase de testes. Lançamento oficial em 2027."));
  assert.doesNotMatch(html, /vistoria|comiss|aluguel/i);
});

test("o layout-mãe dos e-mails (todos os modelos) usa o rodapé antigolpe", () => {
  const fonte = readFileSync(new URL("./templates.ts", import.meta.url), "utf8");
  const layout = fonte.slice(fonte.indexOf("function layout("), fonte.indexOf("function button("));
  assert.match(layout, /rodapeAntigolpeHtml\(SITE_URL\)/);
});
