/*
  E793 Onda 0 — regras puras do painel desenhado no servidor (A4, A5, A6) e a chave.
  Roda: node --test src/lib/auth/e793-onda0-regras.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { ROTAS_DA_ONDA, deveSemear, escolherModo, escolherUsuario, rotaLiberada } from "./painel-sessao-servidor.ts";
import { ondaPainelSessaoServidor } from "../flags.ts";

const A = { id: "A", name: "Ana", email: "a@x", role: "tenant" as const };
const B = { id: "B", name: "Bruno", email: "b@x", role: "owner" as const };
const PILOTO_EXEMPLO = ["/dashboard", "/dashboard/conta", "/dashboard/conta/[secao]", "/dashboard/conta/avaliacoes", "/dashboard/conta/excluir"];

test("chave: off por padrão; só 'piloto' liga; lixo = off", () => {
  assert.equal(ondaPainelSessaoServidor(undefined), "off");
  assert.equal(ondaPainelSessaoServidor(""), "off");
  assert.equal(ondaPainelSessaoServidor("on"), "off");
  assert.equal(ondaPainelSessaoServidor("piloto"), "piloto");
  assert.deepEqual(ROTAS_DA_ONDA.off, []);
});

test("A6: rota fora da lista NÃO libera no 1º quadro; exatas e [segmento] casam", () => {
  assert.equal(rotaLiberada("/dashboard", PILOTO_EXEMPLO), true);
  assert.equal(rotaLiberada("/dashboard/", PILOTO_EXEMPLO), true);
  assert.equal(rotaLiberada("/dashboard/conta/perfil", PILOTO_EXEMPLO), true);
  assert.equal(rotaLiberada("/dashboard/conta/perfil?x=1", PILOTO_EXEMPLO), true);
  assert.equal(rotaLiberada("/dashboard/imoveis", PILOTO_EXEMPLO), false, "fora do piloto");
  assert.equal(rotaLiberada("/dashboard/conta/perfil/extra", PILOTO_EXEMPLO), false, "segmento a mais");
  assert.equal(rotaLiberada("/admin", PILOTO_EXEMPLO), false);
  assert.equal(rotaLiberada("/dashboardx", PILOTO_EXEMPLO), false);
  assert.equal(rotaLiberada(null, PILOTO_EXEMPLO), false);
  assert.equal(rotaLiberada("/dashboard", []), false, "lista vazia (Onda 0) não libera nada");
});

test("A4: na hidratação, o usuário é o do CONTEXTO mesmo com o store persistido de OUTRA conta", () => {
  assert.deepEqual(escolherUsuario({ montado: false, authChecked: false, contexto: B, store: A }), B);
  assert.equal(escolherUsuario({ montado: false, authChecked: true, contexto: null, store: A }), null, "sem contexto: nunca o persistido no 1º quadro");
});

test("A4: depois de montado — antes da conferência contexto ?? store; depois dela, o store (conferência do cliente)", () => {
  assert.deepEqual(escolherUsuario({ montado: true, authChecked: false, contexto: B, store: A }), B);
  assert.deepEqual(escolherUsuario({ montado: true, authChecked: false, contexto: null, store: A }), A);
  assert.deepEqual(escolherUsuario({ montado: true, authChecked: true, contexto: B, store: A }), A);
  assert.equal(escolherUsuario({ montado: true, authChecked: true, contexto: B, store: null }), null, "conferência do cliente disse 'sem sessão'");
});

test("A4: o modo segue a mesma regra", () => {
  assert.equal(escolherModo({ montado: false, authChecked: false, contexto: "owner", store: "tenant" }), "owner");
  assert.equal(escolherModo({ montado: true, authChecked: false, contexto: null, store: "tenant" }), "tenant");
  assert.equal(escolherModo({ montado: true, authChecked: true, contexto: "owner", store: "tenant" }), "tenant");
});

test("A5: semeia com store vazio ou de outra conta; mesma conta não sobrescreve; sem contexto, nada", () => {
  assert.equal(deveSemear(null, B), true);
  assert.equal(deveSemear(A, B), true);
  assert.equal(deveSemear({ ...B, plan: "pro" }, B), false);
  assert.equal(deveSemear(A, null), false);
});
