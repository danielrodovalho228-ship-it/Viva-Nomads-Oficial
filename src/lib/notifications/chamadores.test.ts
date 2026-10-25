/*
  Prompt 44 — GUARDA: todo chamador de notify() passa a CHAVE do evento (a matriz decide o push por ela) e ninguém
  decide o silêncio por fora (semPush com emSilencio): a regra única é a do notify().
  Roda: node --test src/lib/notifications/chamadores.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { MATRIZ_NOTIFICACOES } from "../../config/matriz-notificacoes.ts";

const RAIZ = new URL("../../../", import.meta.url).pathname;

function arquivos(d: string, out: string[] = []): string[] {
  for (const n of readdirSync(d)) {
    const c = join(d, n);
    if (statSync(c).isDirectory()) arquivos(c, out);
    else if (/\.(ts|tsx)$/.test(n) && !/\.test\.ts$/.test(n)) out.push(c);
  }
  return out;
}

/** O objeto passado a cada notify({ … }) — conta as chaves para achar o fim. */
function chamadas(fonte: string): string[] {
  const out: string[] = [];
  let i = fonte.indexOf("notify({");
  while (i >= 0) {
    let prof = 0;
    let j = i + "notify(".length;
    for (; j < fonte.length; j++) {
      if (fonte[j] === "{") prof++;
      else if (fonte[j] === "}" && --prof === 0) break;
    }
    out.push(fonte.slice(i, j + 1));
    i = fonte.indexOf("notify({", j);
  }
  return out;
}

const fontes = arquivos(join(RAIZ, "src")).map((a) => ({ a: a.slice(RAIZ.length), t: readFileSync(a, "utf8") }));

test("GUARDA: todo notify({ … }) passa a chave do evento", () => {
  const sem: string[] = [];
  let total = 0;
  for (const { a, t } of fontes) {
    if (a === "src/lib/notifications/index.ts") continue;
    for (const c of chamadas(t)) {
      total++;
      if (!/\bevent\s*[:,}]/.test(c)) sem.push(`${a}: ${c.slice(0, 80)}`);
    }
  }
  assert.ok(total >= 30, `achei só ${total} chamadas de notify()`);
  assert.deepEqual(sem, [], "notify() sem a chave do evento");
});

test("GUARDA: eventos literais passados ao notify() estão na matriz", () => {
  const fora: string[] = [];
  for (const { a, t } of fontes) {
    for (const c of chamadas(t)) {
      const m = /\bevent\s*:\s*"([a-z0-9_]+)"/.exec(c);
      if (m && !(m[1] in MATRIZ_NOTIFICACOES)) fora.push(`${a}: ${m[1]}`);
    }
  }
  assert.deepEqual(fora, []);
});

test("GUARDA: o silêncio não é decidido fora do notify() (semPush com emSilencio)", () => {
  const fora = fontes.filter(({ t }) => /semPush\s*:\s*emSilencio/.test(t)).map(({ a }) => a);
  assert.deepEqual(fora, []);
});
