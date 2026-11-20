/* E783 — a foto de perfil do cabeçalho não some na Conta/Perfil; iniciais só para quem não tem foto. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const shell = readFileSync(new URL("./dashboard-shell.tsx", import.meta.url), "utf8");

test("o avatar do cabeçalho recebe a foto em qualquer rota (sem exceção por pathname)", () => {
  assert.match(shell, /const fotoNav = myPhoto;/);
  assert.doesNotMatch(shell, /fotoNav = [^;]*\? null/);
});

test("nenhum <Avatar> do site descarta a foto de propósito (photoUrl={undefined/null} fixo)", () => {
  const achados: string[] = [];
  const raiz = new URL("../../", import.meta.url).pathname;
  const ler = (d: string) => { for (const n of readdirSync(d)) { const p = join(d, n); if (statSync(p).isDirectory()) ler(p); else if (/\.tsx$/.test(n) && /photoUrl=\{(undefined|null)\}/.test(readFileSync(p, "utf8"))) achados.push(p.slice(raiz.length)); } };
  ler(raiz);
  assert.deepEqual(achados, []);
});
