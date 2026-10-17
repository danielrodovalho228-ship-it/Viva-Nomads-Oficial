/*
  Faixa D (achado do Moacir 17/10): execuções do laboratório em ec62b16, c03ff36 e bb86a49 gravaram 0/0/0 porque um
  único login falhou no global-setup e derrubou a suíte inteira em ~30 s. Agora cada papel tem 3 tentativas e, se
  ainda assim falhar, a suíte segue (só os specs daquele papel falham).
*/
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { comTentativas } from "../../tests/e2e/fixtures/tentativas.ts";

const raiz = new URL("../../", import.meta.url).pathname;
const semEspera = async () => {};

test("comTentativas: repete até dar certo", async () => {
  let n = 0;
  const r = await comTentativas(async () => { if (++n < 3) throw new Error("falhou"); return "ok"; }, 3, 0, semEspera);
  assert.equal(r, "ok");
  assert.equal(n, 3);
});

test("comTentativas: depois de max falhas, repassa o último erro", async () => {
  let n = 0;
  await assert.rejects(comTentativas(async () => { n++; throw new Error(`erro ${n}`); }, 3, 0, semEspera), /erro 3/);
  assert.equal(n, 3);
});

test("global-setup: login com tentativas e sem abortar a suíte por um papel", () => {
  const s = readFileSync(join(raiz, "tests/e2e/global-setup.ts"), "utf8");
  assert.match(s, /comTentativas\(/);
  assert.match(s, /catch \(e\)[\s\S]*writeFileSync\(authFile\(role\)/);
});
