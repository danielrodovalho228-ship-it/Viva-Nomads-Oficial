/* Roda: node --test src/lib/agentes/aprovacoes.test.ts */
import { test } from "node:test";
import assert from "node:assert/strict";
import { hashConfere, podeDecidir, textoLivreAprova, valeComoOkDoDaniel, type Aprovacao, type ContextoDecisao } from "./aprovacoes.ts";

const agora = new Date("2026-10-09T20:00:00Z");
const base: Aprovacao = { tipo: "merge_pr", status: "pendente", expiraEm: new Date("2026-10-10T20:00:00Z"), hashConteudo: "abc1234" };
const ctx: ContextoDecisao = { agora, ehAdmin: true, ultimoLoginEm: new Date("2026-10-09T19:50:00Z"), confirmou: true };

test("admin com login recente e confirmação aprova", () => {
  assert.deepEqual(podeDecidir(base, ctx, "aprovar"), { ok: true });
});

test("não-admin = 403", () => {
  assert.deepEqual(podeDecidir(base, { ...ctx, ehAdmin: false }, "aprovar"), { ok: false, motivo: "nao_admin", http: 403 });
});

test("sem sessão recente (mais de 15 min) = bloqueado; sem login registrado também", () => {
  const velho = { ...ctx, ultimoLoginEm: new Date("2026-10-09T19:44:00Z") };
  assert.equal(podeDecidir(base, velho, "aprovar").ok, false);
  assert.equal(podeDecidir(base, { ...ctx, ultimoLoginEm: null }, "aprovar").ok, false);
});

test("sem o segundo toque de confirmação = 428", () => {
  assert.deepEqual(podeDecidir(base, { ...ctx, confirmou: false }, "aprovar"), { ok: false, motivo: "sem_confirmacao", http: 428 });
});

test("expirada não vale; dupla aprovação é recusada (idempotente)", () => {
  assert.equal(podeDecidir({ ...base, expiraEm: agora }, ctx, "aprovar").ok, false);
  assert.deepEqual(podeDecidir({ ...base, status: "aprovada" }, ctx, "aprovar"), { ok: false, motivo: "ja_decidida", http: 409 });
});

test("recusar não exige sessão recente nem confirmação, mas exige admin", () => {
  assert.equal(podeDecidir(base, { ...ctx, confirmou: false, ultimoLoginEm: null }, "recusar").ok, true);
  assert.equal(podeDecidir(base, { ...ctx, ehAdmin: false }, "recusar").ok, false);
});

test("hash diferente não mescla; abreviado confere; vazio nunca confere", () => {
  assert.ok(hashConfere("abc1234", "abc1234ffeeddcc"));
  assert.ok(!hashConfere("abc1234", "def1234ffeeddcc"));
  assert.ok(!hashConfere(null, "abc1234"));
  assert.ok(!hashConfere("abc", "abc1234"));
});

test("texto livre 'ok' só leva à confirmação com exatamente 1 cartão", () => {
  assert.equal(textoLivreAprova(1), "pedir_confirmacao");
  assert.equal(textoLivreAprova(2), "mostrar_cartoes");
  assert.equal(textoLivreAprova(0), "nada_pendente");
});

test("aprovação expirada ou recusada não vale como OK do Daniel", () => {
  assert.ok(valeComoOkDoDaniel({ ...base, status: "aprovada" }, agora));
  assert.ok(!valeComoOkDoDaniel({ ...base, status: "aprovada", expiraEm: agora }, agora));
  assert.ok(!valeComoOkDoDaniel({ ...base, status: "recusada" }, agora));
});
