import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { TIPOS_ASSISTENTE } from "../../src/lib/anuncio/assistente-telas.ts";

// E744: o Passo 1 mostra 3 tipos e "Ver mais tipos" (tipos-ver-mais) abre os nove (E607); os specs que contam 9 fotos abrem antes.
test("o Passo 1 tem 9 tipos, 3 à vista e o botão tipos-ver-mais", () => {
  const s = readFileSync("src/app/(dashboard)/dashboard/imoveis/novo/etapa-tipo.tsx", "utf8");
  assert.equal(TIPOS_ASSISTENTE.length, 9);
  assert.match(s, /TIPOS_A_VISTA = 3/);
  assert.match(s, /data-testid="tipos-ver-mais"/);
});
for (const f of ["t691-e259-polimento-assistente", "t704-e265-tipos-sem-selo", "t706-e271-passo10-uma-vez"]) {
  test(`${f}: abre "Ver mais tipos" antes de contar as nove fotos`, () => {
    const s = readFileSync(`tests/e2e/specs/${f}.spec.ts`, "utf8");
    const i = s.indexOf('getByTestId("tipos-ver-mais")');
    assert.ok(i > 0, "clica em tipos-ver-mais");
    assert.ok(i < s.indexOf("toHaveCount(9"), "antes da contagem de nove");
  });
}
