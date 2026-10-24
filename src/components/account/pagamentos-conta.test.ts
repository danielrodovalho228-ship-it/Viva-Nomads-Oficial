import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// t262: /dashboard/conta tinha 2 botões primários ("Salvar perfil" e "Salvar chave"). O da chave Pix é secundário.
const fonte = readFileSync("src/components/account/pagamentos-conta.tsx", "utf8");

test("'Salvar chave' não é botão primário (um primário por tela)", () => {
  const botao = fonte.match(/<Button[^>]*data-testid="conta-pix-salvar"[^>]*>/);
  assert.ok(botao, "botão conta-pix-salvar existe");
  assert.match(botao[0], /variant="secondary"/);
});
