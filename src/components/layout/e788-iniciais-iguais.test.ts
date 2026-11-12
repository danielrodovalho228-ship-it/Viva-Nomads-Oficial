/*
  E788 (reprova da prova ao vivo de 11/11): as iniciais da MESMA conta divergiam por superfície — observadora "C" no
  cabeçalho e no rodapé do admin × "CQ" no Perfil; Paulo "P" × "PP". Causa: a casca e o topo do site passavam ao avatar
  só o PRIMEIRO nome, e o Perfil o nome completo. Agora todo avatar da própria conta usa a mesma fonte (nome completo).
  Roda: node --test src/components/layout/e788-iniciais-iguais.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { iniciais } from "../../lib/avatar.ts";
import { nomeParaAvatar } from "../../lib/display-name.ts";

test("uma regra só: nome completo → as mesmas iniciais em toda parte; marca de conta de teste e e-mail não viram letra", () => {
  assert.equal(iniciais(nomeParaAvatar("Camila Quintela")), "CQ");
  assert.equal(iniciais(nomeParaAvatar("[TESTE QA] Paulo Pereira")), "PP");
  assert.equal(iniciais("[TESTE QA] Paulo Pereira"), "PP", "a marca entre colchetes não entra nas iniciais");
  assert.equal(nomeParaAvatar("camila@exemplo.com"), "", "e-mail não vira rosto (CONTA-A: silhueta)");
  assert.equal(nomeParaAvatar(null), "");
});

test("a casca do painel e o topo do site passam ao avatar o nome completo (a mesma fonte do Perfil), não o primeiro nome", () => {
  const casca = readFileSync("src/components/layout/dashboard-shell.tsx", "utf8");
  assert.match(casca, /const nomeAvatar = nomeAvatarExibicao\(displayUser\);/);
  const topo = readFileSync("src/components/layout/navbar.tsx", "utf8");
  assert.match(topo, /<MeuPainel nome=\{nomeAvatar\}/);
  assert.match(topo, /const nomeAvatar = nomeAvatarExibicao\(user\);/);
  const perfil = readFileSync("src/components/account/perfil-tela.tsx", "utf8");
  assert.match(perfil, /<Avatar name=\{nomeParaAvatar\(nome\)\}/);
});
