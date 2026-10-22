import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { COOKIE_ADMIN_ATIVO, semCookieDeAtividade } from "../e2e/fixtures/sessao-gravada.ts";
import { COOKIE_ADMIN_ATIVO as COOKIE_DO_PRODUTO } from "../../src/lib/admin/sessao-ociosa.ts";

/**
 * Lab de 20 e 21/10 (11 execuções "metade", inclusive a rodada 2 da t249, d55e100): o cookie de atividade da
 * admin ia gravado na sessão do global-setup com a hora do setup. Depois de 30 min, a primeira aba nova da admin
 * parecia ociosa, o proxy encerrava a sessão compartilhada e t220–t242, t24–t26 caíam no login.
 */
test("o nome do cookie é o mesmo do produto", () => {
  assert.equal(COOKIE_ADMIN_ATIVO, COOKIE_DO_PRODUTO);
});

test("a sessão gravada sai sem o cookie de atividade e mantém os outros", () => {
  const estado = { cookies: [{ name: "sb-127-auth-token" }, { name: COOKIE_ADMIN_ATIVO }], origins: [] };
  assert.deepEqual(semCookieDeAtividade(estado).cookies, [{ name: "sb-127-auth-token" }]);
});

test("o global-setup grava a sessão pelo filtro", () => {
  const src = readFileSync("tests/e2e/global-setup.ts", "utf8");
  assert.match(src, /semCookieDeAtividade\(await context\.storageState\(\)\)/);
  assert.doesNotMatch(src, /storageState\(\{ path/);
});
