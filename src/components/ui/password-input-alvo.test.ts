/* Roda: node --test src/components/ui/password-input-alvo.test.ts — varredura 01/11 (Pista A): em Conta › Segurança e
   na troca de senha (/auth/reset) o campo de senha tinha 23 px (só a linha do texto, dentro de uma caixa maior) e o
   "olho" 16 px. Agora o campo e o olho têm 44 px, como no /auth (t259), e a fonte é de 16 px no celular. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const campo = readFileSync(new URL("./password-input.tsx", import.meta.url), "utf8");
const conta = readFileSync(new URL("../account/conta-secoes.tsx", import.meta.url), "utf8");
const reset = readFileSync(new URL("../../app/auth/reset/page.tsx", import.meta.url), "utf8");

test("campo e olho com 44 px", () => {
  assert.match(campo, /"min-h-11 w-full bg-transparent outline-none/);
  assert.match(campo, /className="-mr-3 grid h-11 w-11 shrink-0 place-items-center/);
});

test("as caixas não somam padding vertical e a fonte é de 16 px no celular", () => {
  for (const src of [conta, reset]) {
    const usos = src.split("<PasswordInput").slice(1).map((u) => u.slice(0, u.indexOf("/>")));
    assert.ok(usos.length > 0);
    for (const u of usos) {
      assert.doesNotMatch(u, /className="[^"]*\bpy-[23]\b/);
      assert.match(u, /inputClassName="text-base sm:text-sm"/);
    }
  }
});
