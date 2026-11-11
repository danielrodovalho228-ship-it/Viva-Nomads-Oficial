import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// E744: /dashboard/conta/notificacoes redireciona (E176) para /dashboard/notificacoes; as varreduras
// que exigem "pathname == rota" precisam apontar para o destino final, senão acusam "caiu fora da tela" em 1280.
test("next.config mantém o redirect E176 de Notificações", () => {
  assert.match(readFileSync("next.config.ts", "utf8"), /source: "\/dashboard\/conta\/notificacoes", destination: "\/dashboard\/notificacoes"/);
});
for (const f of ["t329-varredura-bloco11", "t354-varredura-bloco19", "t385-varredura-bloco21"]) {
  test(`${f} varre Notificações no endereço final`, () => {
    const s = readFileSync(`tests/e2e/specs/${f}.spec.ts`, "utf8");
    assert.match(s, /"\/dashboard\/notificacoes" : `\/dashboard\/conta/);
  });
}
