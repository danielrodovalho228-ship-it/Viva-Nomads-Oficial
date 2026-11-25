/* Roda: node --test src/components/layout/e788-selo-equipe-sem-avatar.test.ts — E788: selo "Equipe" sem avatar inerte; inicial legível e igual em toda parte. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { iniciais } from "../../lib/avatar.ts";

const selo = readFileSync("src/components/layout/papel-ativo.tsx", "utf8");
const equipe = selo.slice(selo.indexOf("if (!papel) {"), selo.indexOf("return (\n    <Link"));

test("o selo da equipe é só texto: sem avatar, sem link, sem botão", () => {
  assert.ok(equipe.length > 0);
  assert.doesNotMatch(equipe, /<Avatar|<Link|<button|href=/);
  assert.match(equipe, /Papel ativo: /);
});
test("papéis com Perfil seguem com avatar e link", () => {
  assert.match(selo, /<Link[\s\S]*?<Avatar/);
});
test("a inicial é sempre maiúscula (função única) e o círculo nunca a desenha abaixo de 13 px", () => {
  assert.equal(iniciais("camila"), "C");
  assert.equal(iniciais("Camila Souza"), "CS");
  const av = readFileSync("src/components/ui/avatar.tsx", "utf8");
  assert.match(av, /TAMANHO_MINIMO_INICIAL = 13/);
  assert.match(av, /Math\.max\(size \* 0\.4, TAMANHO_MINIMO_INICIAL\)/);
  assert.match(av, /rounded-full uppercase font-title/);
});
