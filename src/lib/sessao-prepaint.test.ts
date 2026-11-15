/* Roda: node --test src/lib/sessao-prepaint.test.ts
  E398: o cabeçalho público não pisca o "Entrar" para quem tem sessão: marca antes da 1ª pintura + CSS + limpeza da
  lembrança velha. Na tela: t1664. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { CHAVE_SESSAO_LOCAL, MARCA_SESSAO, SESSAO_PREPAINT_SCRIPT } from "./sessao-prepaint.ts";

/** Executa o script de verdade, com documento e armazenamento falsos. */
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
  return marcas[MARCA_SESSAO] ?? null;
}

test("E398: com usuário no store persistido, marca a sessão antes da pintura", () => {
  assert.equal(rodar(JSON.stringify({ state: { user: { id: "u1", name: "Ana" } }, version: 0 })), "1");
});

test("E398: visitante (sem chave, usuário nulo, JSON ruim ou armazenamento bloqueado) não é marcado e nada quebra", () => {
  assert.equal(rodar(null), null);
  assert.equal(rodar(JSON.stringify({ state: { user: null } })), null);
  assert.equal(rodar("{não é json"), null);
  assert.equal(rodar("erro"), null);
});

test("E398: a chave do script é a do store de sessão", () => {
  assert.match(readFileSync("src/lib/store.ts", "utf8"), new RegExp(`name: "${CHAVE_SESSAO_LOCAL}"`));
});

test("E398: o layout injeta o script no <head>; o CSS esconde só o Entrar, sem tirar o espaço; o cabeçalho limpa a lembrança velha", () => {
  const layout = readFileSync("src/app/layout.tsx", "utf8");
  assert.match(layout, /__html: SESSAO_PREPAINT_SCRIPT/);
  assert.ok(layout.indexOf("SESSAO_PREPAINT_SCRIPT }") < layout.indexOf("</head>"), "antes da primeira pintura");
  assert.match(readFileSync("src/app/globals.css", "utf8"), /html\[data-sessao="1"\] \[data-nav-entrar\] \{\s*visibility: hidden;/);
  const nav = readFileSync("src/components/layout/navbar.tsx", "utf8");
  assert.equal((nav.match(/data-nav-entrar=""/g) ?? []).length, 2, "computador e menu do celular");
  assert.match(nav, /if \(mounted && sessaoConferida && !user\) document\.documentElement\.removeAttribute\(MARCA_SESSAO\);/);
});
