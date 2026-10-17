import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

/**
 * Lab 17/10: com a suíte inteira carregando de novo (~760 testes), a execução leva ~45 min e o
 * `timeout-minutes: 45` do job a cancelava ANTES de gravar em public.lab_execucoes (o passo de registro
 * só roda se o job não foi cancelado). O Playwright agora tem prazo próprio MENOR que o do job: se
 * estourar, ele encerra com relatório e o resultado parcial ainda vai para o banco.
 */
const yml = readFileSync(".github/workflows/laboratorio.yml", "utf8");

test("o prazo do job é folgado (>= 80 min)", () => {
  const min = Number(/timeout-minutes:\s*(\d+)/.exec(yml)?.[1]);
  assert.ok(min >= 80, `timeout-minutes do job = ${min}`);
});

test("o Playwright tem --global-timeout menor que o do job, para sobrar tempo de gravar o resultado", () => {
  const ms = Number(/--global-timeout=(\d+)/.exec(yml)?.[1]);
  const job = Number(/timeout-minutes:\s*(\d+)/.exec(yml)?.[1]);
  assert.ok(ms >= 55 * 60_000, `global-timeout = ${ms} ms`);
  assert.ok(ms <= (job - 10) * 60_000, "precisa sobrar pelo menos 10 min depois da suíte");
});
