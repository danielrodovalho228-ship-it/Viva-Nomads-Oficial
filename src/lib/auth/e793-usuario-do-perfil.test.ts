/*
  E793 Onda 0 — o mapeamento perfil → SessionUser é UM só, usado pelo AuthProvider (cliente) e pela sessão do servidor.
  Mesmos casos do AuthProvider: perfil com dados, perfil ausente, is_teste nulo, nome/papel faltando no perfil.
  Roda: node --test src/lib/auth/e793-usuario-do-perfil.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { usuarioDaSessaoBase, usuarioDoPerfil } from "./usuario-do-perfil.ts";

const base = { id: "u1", email: "ana@x.com", metaName: "Ana Meta", metaRole: "owner" as const };

test("base da sessão (antes de ler o perfil): nome do metadata, papel do metadata, isTeste ainda indefinido", () => {
  assert.deepEqual(usuarioDaSessaoBase(base), { id: "u1", name: "Ana Meta", fullName: "Ana Meta", email: "ana@x.com", role: "owner" });
  assert.deepEqual(usuarioDaSessaoBase({ id: "u2", email: "b@x.com" }), { id: "u2", name: "b@x.com", fullName: undefined, email: "b@x.com", role: "tenant" });
  assert.deepEqual(usuarioDaSessaoBase({ id: "u3" }), { id: "u3", name: "Usuário", fullName: undefined, email: "", role: "tenant" });
});

test("perfil lido: nome e papel do perfil vencem o metadata; is_teste true → true", () => {
  assert.deepEqual(usuarioDoPerfil(base, { full_name: "Ana Souza", role: "tenant", is_teste: true }), {
    id: "u1", name: "Ana Souza", fullName: "Ana Souza", email: "ana@x.com", role: "tenant", isTeste: true,
  });
});

test("perfil sem nome/papel: cai no metadata; is_teste nulo → false (E518)", () => {
  assert.deepEqual(usuarioDoPerfil(base, { full_name: null, role: null, is_teste: null }), {
    id: "u1", name: "Ana Meta", fullName: "Ana Meta", email: "ana@x.com", role: "owner", isTeste: false,
  });
});

test("perfil ausente (linha não existe): a base da sessão com isTeste false (o resolverIsTeste do AuthProvider)", () => {
  assert.deepEqual(usuarioDoPerfil(base, null), { ...usuarioDaSessaoBase(base), isTeste: false });
});

test("o AuthProvider usa as MESMAS funções (fonte única)", () => {
  const ap = readFileSync("src/components/auth-provider.tsx", "utf8");
  assert.match(ap, /usuarioDaSessaoBase\(/);
  assert.match(ap, /usuarioDoPerfil\(/);
  assert.doesNotMatch(ap, /name: profile\.full_name \?\? metaName/, "o mapeamento à mão saiu do AuthProvider");
});
