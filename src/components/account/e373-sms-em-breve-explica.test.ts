/* Roda: node --test src/components/account/e373-sms-em-breve-explica.test.ts
  E373: com o SMS desligado por desenho, a tela de verificação do celular diz o porquê, que não é pendência e o que muda quando ligar. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const src = readFileSync("src/components/account/telefone-verificacao.tsx", "utf8");
const bloco = src.slice(src.indexOf('data-testid="telefone-em-breve"'), src.indexOf("estado.disponivel && estado.verificado"));

test("E373: o estado 'em breve' explica o motivo, que não é pendência e o que acontece quando o SMS entrar", () => {
  assert.match(bloco, /data-testid="telefone-em-breve-motivo"/);
  assert.match(bloco, /ainda não foi ligado na Viva, por isso o campo está desativado/);
  assert.match(bloco, /Não é uma pendência sua: a verificação é opcional/);
  assert.match(bloco, /Quando o SMS entrar no ar, este campo passa a funcionar/);
});

test("E373: o campo segue desabilitado e sem erro (SMS inativo por desenho)", () => {
  assert.match(bloco, /<input disabled aria-label="Celular \(em breve\)"/);
  assert.doesNotMatch(bloco, /role="alert"/);
});
