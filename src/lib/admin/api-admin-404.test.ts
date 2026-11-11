/*
  Ordem 12a8086d, item 1: "checagem no servidor em toda rota /admin e /api/admin; owner/tenant recebem 404".
  As páginas /admin já respondem 404 (proxy + layout). Esta guarda cobre a API: toda rota em src/app/api/admin
  recusa quem não é admin com 404 "Não encontrado." (a API do admin não revela que existe), pela resposta única
  respostaNaoAdmin(). Nenhuma rota pode responder 403 "Só admin.".
  Roda: node --test src/lib/admin/api-admin-404.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const raiz = fileURLToPath(new URL("../../../", import.meta.url));
const pastaApiAdmin = join(raiz, "src/app/api/admin");

function rotas(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) return rotas(p);
    return n === "route.ts" ? [p] : [];
  });
}

test("existe ao menos uma rota em /api/admin (a guarda não passa vazia)", () => {
  assert.ok(rotas(pastaApiAdmin).length >= 9);
});

test("nenhuma rota de /api/admin responde 403 'Só admin.' (não revela que existe)", () => {
  const com403 = rotas(pastaApiAdmin)
    .filter((p) => /Só admin\.|status:\s*403/.test(readFileSync(p, "utf8")))
    .map((p) => relative(raiz, p));
  assert.deepEqual(com403, []);
});

test("toda rota de /api/admin que checa admin usa respostaNaoAdmin()", () => {
  const sem = rotas(pastaApiAdmin)
    .filter((p) => {
      const s = readFileSync(p, "utf8");
      // A rota de provas do contrato já respondia 404 com { error: "Não encontrado." } e fica como está.
      if (/status:\s*404/.test(s) && /Não encontrado\./.test(s) && !/respostaNaoAdmin/.test(s)) return false;
      return !/respostaNaoAdmin\(\)/.test(s);
    })
    .map((p) => relative(raiz, p));
  assert.deepEqual(sem, []);
});

test("respostaNaoAdmin(): 404, 'Não encontrado.' e sem cache", async () => {
  const { respostaNaoAdmin } = await import("./api-nao-admin.ts");
  const r = respostaNaoAdmin();
  assert.equal(r.status, 404);
  assert.equal(r.headers.get("cache-control"), "no-store");
  assert.deepEqual(await r.json(), { erro: "Não encontrado." });
});
