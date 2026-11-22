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

/*
  ORDEM-DUET-450: sobre a main, quatro rotas da Central respondiam 403. A rota só recusava quando o Supabase não estava
  configurado; com sessão de visitante ou de conta comum, repassava a resposta do motor (src/lib/agentes/motor.ts), que
  diz 403 "Só admin.". A guarda acima não via isso, porque o 403 não está escrito na rota. Regra: quem repassa o status
  de outra camada confere o admin ANTES, na própria rota.
*/
const HANDLER = /export async function (GET|POST|PUT|PATCH|DELETE)\b/;
function handlers(fonte: string): { metodo: string; corpo: string }[] {
  const partes = fonte.split(HANDLER);
  const saida: { metodo: string; corpo: string }[] = [];
  for (let i = 1; i < partes.length; i += 2) saida.push({ metodo: partes[i], corpo: partes[i + 1] ?? "" });
  return saida;
}

test("rota que repassa o status de outra camada confere o admin antes (o 403 do motor não sai pela API)", () => {
  const falhas: string[] = [];
  let repassam = 0;
  for (const p of rotas(pastaApiAdmin)) {
    for (const h of handlers(readFileSync(p, "utf8"))) {
      const repasse = h.corpo.search(/status:\s*r\.(status|http)\b/);
      if (repasse < 0) continue;
      repassam++;
      const antes = h.corpo.slice(0, repasse);
      const confere = /!\(await deps\.adminId\(\)\)\) return respostaNaoAdmin\(\)/.test(antes) || /if \(!deps\.admin\) return respostaNaoAdmin\(\)/.test(antes);
      if (!confere) falhas.push(`${relative(raiz, p)} ${h.metodo}`);
    }
  }
  assert.ok(repassam >= 6, "a guarda não passa vazia: chat, executar, memória (GET e DELETE), reunião e a decisão da aprovação");
  assert.deepEqual(falhas, []);
});

test("a decisão da aprovação confere o admin antes de validar o id (o 400 não revela a rota a quem não é admin)", () => {
  const s = readFileSync(join(pastaApiAdmin, "aprovacoes/[id]/route.ts"), "utf8");
  const admin = s.indexOf("if (!deps.admin) return respostaNaoAdmin()");
  const id = s.indexOf("UUID.test(id)");
  assert.ok(admin > 0 && id > 0);
  assert.ok(admin < id, "o admin é conferido antes do formato do id");
});

test("respostaNaoAdmin(): 404, 'Não encontrado.' e sem cache", async () => {
  const { respostaNaoAdmin } = await import("./api-nao-admin.ts");
  const r = respostaNaoAdmin();
  assert.equal(r.status, 404);
  assert.equal(r.headers.get("cache-control"), "no-store");
  assert.deepEqual(await r.json(), { erro: "Não encontrado." });
});
