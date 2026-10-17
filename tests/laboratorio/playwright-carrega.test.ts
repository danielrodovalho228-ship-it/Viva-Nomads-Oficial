import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";

// Achado do Moacir (ronda 17/10): o laboratório gravou 0/0/0 em 10 execuções seguidas porque um spec
// quebrava o CARREGAMENTO de toda a suíte ("Cannot use({ defaultBrowserType }) in a describe group").
// Se algum spec não carregar, o Playwright lista 0 testes e este teste falha antes do merge.
test("o Playwright carrega todos os specs (a suíte não pode morrer na listagem)", () => {
  const r = spawnSync("npx", ["playwright", "test", "--list"], { encoding: "utf8", timeout: 120_000 });
  const saida = `${r.stdout}\n${r.stderr}`;
  assert.equal(r.status, 0, saida.slice(-1500));
  const total = /Total: (\d+) tests? in (\d+) files?/.exec(saida);
  assert.ok(total, "sem a linha 'Total:' na listagem");
  assert.ok(Number(total[1]) > 100, `só ${total[1]} testes listados`);
});
