/*
  E1248 PR 1 — a rotina de hora a hora da devolução da caução (ESPEC-E1248 v11, 2.3 e 8.3-2; ORDENS 1322 e 1325): rota
  própria, no molde da do pré-aceite, com uma linha nova no vercel.json. Corre SEM chave (decisão 2): o silêncio vale
  desde o primeiro dia; só a escrita nos prazos, no PR 2, fica atrás da chave.
  Roda: node --test src/lib/caucao/e1248-rota-hora-a-hora.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

const ROTA = "src/app/api/cron/devolucao-caucao/route.ts";

test("vercel.json: a rotina da devolução corre de hora a hora", () => {
  const v = JSON.parse(readFileSync("vercel.json", "utf8")) as { crons: { path: string; schedule: string }[] };
  const linhas = v.crons.filter((c) => c.path === "/api/cron/devolucao-caucao");
  assert.equal(linhas.length, 1, "uma linha só");
  assert.match(linhas[0].schedule, /^\d{1,2} \* \* \* \*$/, "uma vez por hora");
});

test("a rota: exige o segredo do cron, corre sem chave e chama a rotina real", () => {
  assert.ok(existsSync(ROTA), "a rota existe");
  const f = readFileSync(ROTA, "utf8");
  assert.match(f, /process\.env\.CRON_SECRET/);
  assert.match(f, /`Bearer \$\{segredo\}`/);
  assert.match(f, /rodarDevolucaoCaucao\(admin, agora\)/);
  assert.doesNotMatch(f, /@\/lib\/flags/, "sem chave: a máquina corre desde o primeiro dia");
  assert.match(f, /integracoesSimuladas\(\) \? new URL\(request\.url\)\.searchParams\.get\("agora"\)/, "o relógio simulado só no laboratório");
});
