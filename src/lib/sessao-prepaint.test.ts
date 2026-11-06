/* Roda: node --test src/lib/sessao-prepaint.test.ts
  E398: o cabeçalho público não pisca o "Entrar" para quem tem sessão: pista local antes da 1ª pintura + CSS + limpeza da pista velha. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { CHAVE_SESSAO_LOCAL, SESSAO_PREPAINT_SCRIPT } from "./sessao-prepaint.ts";

function rodar(armazenado: string | null | "erro"): string | null {
  const marcas: Record<string, string> = {};
  const documento = { documentElement: { setAttribute: (k: string, v: string) => (marcas[k] = v) } };
  const localStorage = {
    getItem: (k: string) => {
      if (armazenado === "erro") throw new Error("bloqueado");
      return k === CHAVE_SESSAO_LOCAL ? armazenado : null;
    },
  };
  new Function("document", "localStorage", SESSAO_PREPAINT_SCRIPT)(documento, localStorage);
  return marcas["data-sessao"] ?? null;
}

test("E398: com usuário no store persistido, marca a sessão antes da pintura", () => {
  assert.equal(rodar(JSON.stringify({ state: { user: { id: "u1", name: "Ana" } }, version: 0 })), "1");
});

test("E398: visitante (sem chave, user nulo, JSON ruim ou armazenamento bloqueado) não é marcado e nada quebra", () => {
  assert.equal(rodar(null), null);
  assert.equal(rodar(JSON.stringify({ state: { user: null } })), null);
  assert.equal(rodar("{não é json"), null);
  assert.equal(rodar("erro"), null);
});

test("E398: layout injeta o script, o CSS esconde só o Entrar (sem tirar o espaço) e o cabeçalho limpa a pista velha", () => {
  assert.match(readFileSync("src/app/layout.tsx", "utf8"), /__html: SESSAO_PREPAINT_SCRIPT/);
  assert.match(readFileSync("src/app/globals.css", "utf8"), /html\[data-sessao="1"\] \[data-nav-entrar\] \{\s*visibility: hidden;/);
  const nav = readFileSync("src/components/layout/navbar.tsx", "utf8");
  assert.equal((nav.match(/data-nav-entrar=""/g) ?? []).length, 2, "desktop e menu do celular");
  assert.match(nav, /if \(mounted && sessaoConferida && !user\) document\.documentElement\.removeAttribute\("data-sessao"\);/);
});
