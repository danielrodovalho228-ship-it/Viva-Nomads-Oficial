import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";

// E744: "Enviar mesmo assim" (aviso do filtro de contato) casa por substring com name:"Enviar"; os specs de mensagem usam nome exato.
for (const f of ["t379-55e2-filtro-contato-um-toque", "t41-mensagens", "t43-notificacoes"]) {
  test(`${f}: o botão Enviar é buscado pelo nome exato`, () => {
    const s = readFileSync(`tests/e2e/specs/${f}.spec.ts`, "utf8");
    assert.doesNotMatch(s, /name: "Enviar" \}/);
    assert.match(s, /name: "Enviar", exact: true/);
  });
}
test("o aviso do filtro de contato tem o botão 'Enviar mesmo assim' (a causa da ambiguidade)", () => {
  const out = execFileSync("grep", ["-rl", "Enviar mesmo assim", "src"], { encoding: "utf8" }).trim();
  assert.ok(out.length > 0);
});
