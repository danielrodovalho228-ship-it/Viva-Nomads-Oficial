import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// t183 (admin, 390 px): a Caixa de e-mails de teste entra na tela depois do carregamento e não pode empurrar o que vem
// antes. A8 (perfil-08): ela fica por último na tela Ajuda; "Sair da Viva" (zona de exclusão) tem a sua própria tela.
test("Conta: a caixa de e-mails de teste vem por último na Ajuda, longe da zona de exclusão", () => {
  const ajuda = readFileSync(new URL("../components/account/tela-ajuda.tsx", import.meta.url), "utf8");
  const caixa = ajuda.indexOf("<CaixaEmailsTeste />");
  assert.ok(caixa > 0);
  for (const antes of ["ajuda-sair", "ajuda-rodape"]) assert.ok(ajuda.indexOf(antes) < caixa, antes);
  const excluir = readFileSync(new URL("../app/(dashboard)/dashboard/conta/excluir/page.tsx", import.meta.url), "utf8");
  assert.match(excluir, /<SairDaViva \/>/);
  assert.doesNotMatch(excluir, /CaixaEmailsTeste/);
});
