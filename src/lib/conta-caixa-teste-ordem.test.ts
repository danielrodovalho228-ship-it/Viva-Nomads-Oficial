import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// t183 (admin, 390 px): a Caixa de e-mails de teste entra na tela depois do carregamento. Se ficar acima de
// "Excluir conta", empurra o botão para fora da tela depois da rolagem. Por isso vem por último.
test("Conta: a caixa de e-mails de teste vem depois da zona de exclusão", () => {
  const src = readFileSync(new URL("../app/(dashboard)/dashboard/conta/page.tsx", import.meta.url), "utf8");
  const exclusao = src.indexOf("<DangerZone />");
  const caixa = src.indexOf("<CaixaEmailsTeste />");
  assert.ok(exclusao > 0 && caixa > 0);
  assert.ok(caixa > exclusao, "CaixaEmailsTeste deve vir depois de DangerZone");
});
