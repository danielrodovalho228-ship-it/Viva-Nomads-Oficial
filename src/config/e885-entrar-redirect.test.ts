/*
  E885: /entrar respondia 404 (com a página de "não encontrado"). O endereço natural de entrada vai para /auth na
  própria resposta HTTP, com a query preservada (o Next repassa ?redirect=… sozinho). Usa o casador de rotas do Next.
  Roda: node --test src/config/e885-entrar-redirect.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { existsSync } from "node:fs";

const require = createRequire(import.meta.url);
const { getPathMatch } = require("next/dist/shared/lib/router/utils/path-match");

interface Redirect { source: string; destination: string; has?: unknown[]; missing?: unknown[]; permanent?: boolean; statusCode?: number }

async function redirectDe(caminho: string): Promise<Redirect | null> {
  const m = await import("../../next.config.ts");
  const lista: Redirect[] = await m.default.redirects!();
  for (const r of lista.filter((x) => !x.has && !x.missing)) {
    const p = getPathMatch(r.source, { strict: true, removeUnnamedParams: true, regexModifier: (s: string) => s })(caminho);
    if (p) return r;
  }
  return null;
}

test("E885: /entrar vai para /auth (redirect, não 404)", async () => {
  const r = await redirectDe("/entrar");
  assert.ok(r, "sem redirect para /entrar");
  assert.equal(r.destination, "/auth");
  assert.equal(r.permanent, true);
});

test("E885: não há página própria em /entrar disputando com o redirect", () => {
  assert.equal(existsSync(new URL("../app/(public)/entrar", import.meta.url)), false);
  assert.equal(existsSync(new URL("../app/entrar", import.meta.url)), false);
});
