/*
  E901: /fale-com-a-viva respondia 404; a página mora em /ajuda/fale-com-a-viva. Redirecionamento permanente (308) na própria
  resposta HTTP, conferido com o casador de rotas do Next. Âmbito fechado: só o redirect (nenhum link interno a corrigir).
  Roda: node --test src/config/e901-fale-com-a-viva-redirect.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { existsSync } from "node:fs";

const require = createRequire(import.meta.url);
const { getPathMatch } = require("next/dist/shared/lib/router/utils/path-match");

interface Redirect { source: string; destination: string; has?: unknown[]; missing?: unknown[]; permanent?: boolean }

async function redirectDe(caminho: string): Promise<Redirect | null> {
  const m = await import("../../next.config.ts");
  const lista: Redirect[] = await m.default.redirects!();
  for (const r of lista.filter((x) => !x.has && !x.missing)) {
    if (getPathMatch(r.source, { strict: true, removeUnnamedParams: true, regexModifier: (s: string) => s })(caminho)) return r;
  }
  return null;
}

test("E901: /fale-com-a-viva vai, permanente, para /ajuda/fale-com-a-viva", async () => {
  const r = await redirectDe("/fale-com-a-viva");
  assert.ok(r, "sem redirect para /fale-com-a-viva");
  assert.equal(r.destination, "/ajuda/fale-com-a-viva");
  assert.equal(r.permanent, true);
});

test("E901: o destino existe e a página certa não é redirecionada", async () => {
  assert.ok(existsSync(new URL("../app/(public)/ajuda/fale-com-a-viva", import.meta.url)));
  assert.equal(await redirectDe("/ajuda/fale-com-a-viva"), null);
});
