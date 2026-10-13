import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  aposFalha,
  avisarPoucosCodigos,
  bloqueado,
  codigoRecuperacaoValido,
  gerarCodigoEmail,
  gerarCodigos,
  hashCodigo,
  hashCodigoEmail,
  normalizarCodigo,
  senhaRecente,
} from "./codigos-recuperacao.ts";
import { MSG_CODIGO_NAO_CONFERE, MSG_CODIGO_NAO_CONFERE_NOVO, mensagemErroMfa } from "../admin/mfa.ts";

test("gera 10 códigos únicos, 10 caracteres sem ambiguidade", () => {
  const cs = gerarCodigos();
  assert.equal(cs.length, 10);
  assert.equal(new Set(cs).size, 10);
  for (const c of cs) assert.match(c, /^[A-HJKMNP-Z2-9]{5}-[A-HJKMNP-Z2-9]{5}$/);
});

test("hash: determinístico, ignora traço/caixa, muda por usuário e nunca contém o código", () => {
  const h = hashCodigo("u1", "ABCDE-FGHJK");
  assert.equal(h, hashCodigo("u1", "abcde fghjk"));
  assert.notEqual(h, hashCodigo("u2", "ABCDE-FGHJK"));
  assert.match(h, /^[0-9a-f]{64}$/);
  assert.ok(!h.includes("ABCDE"));
});

test("validação: caso positivo e negativos", () => {
  assert.equal(codigoRecuperacaoValido("abcde-fghjk"), "ABCDEFGHJK");
  assert.equal(codigoRecuperacaoValido("ABCDE-FGHJ"), null);
  assert.equal(codigoRecuperacaoValido("ABCDE-FGHJ0"), null); // 0 não existe no alfabeto
  assert.equal(codigoRecuperacaoValido(""), null);
  assert.equal(normalizarCodigo(" ab-cd "), "ABCD");
});

test("aviso quando restam 2 ou menos", () => {
  assert.equal(avisarPoucosCodigos(3), false);
  assert.equal(avisarPoucosCodigos(2), true);
  assert.equal(avisarPoucosCodigos(0), true);
});

test("5 falhas bloqueiam por 15 min; passado o bloqueio recomeça do zero", () => {
  const t = 1_000_000;
  let e = { falhas: 0, bloqueadoAte: null as number | null };
  for (let i = 0; i < 4; i++) {
    e = aposFalha(e, t);
    assert.equal(bloqueado(e, t), false);
  }
  e = aposFalha(e, t);
  assert.equal(bloqueado(e, t), true);
  assert.equal(bloqueado(e, t + 15 * 60 * 1000 + 1), false);
  assert.equal(aposFalha(e, t + 15 * 60 * 1000 + 1).falhas, 1);
});

test("senha recente: só nos últimos 5 minutos", () => {
  const agora = Date.parse("2026-10-13T21:00:00Z");
  assert.equal(senhaRecente("2026-10-13T20:58:00Z", agora), true);
  assert.equal(senhaRecente("2026-10-13T20:50:00Z", agora), false);
  assert.equal(senhaRecente(null, agora), false);
});

test("código do e-mail: 6 dígitos, hash ligado ao usuário", () => {
  assert.match(gerarCodigoEmail(), /^\d{6}$/);
  assert.equal(gerarCodigoEmail(() => 42), "000042");
  assert.notEqual(hashCodigoEmail("u1", "123456"), hashCodigoEmail("u2", "123456"));
});

test("mensagem do código recusado pede relógio automático e a entrada mais nova do app", () => {
  for (const m of [MSG_CODIGO_NAO_CONFERE, MSG_CODIGO_NAO_CONFERE_NOVO, mensagemErroMfa("mfa_verification_failed")]) {
    assert.match(m, /relógio do celular está no automático/);
    assert.match(m, /entrada mais nova do app/);
  }
});

test("server actions: autorização no servidor, service role fora do cliente, só hash", () => {
  const src = readFileSync(new URL("./recuperacao-actions.ts", import.meta.url), "utf8");
  assert.match(src, /^"use server"/);
  assert.match(src, /hashCodigo\(/);
  assert.match(src, /senhaRecente/);
  assert.match(src, /role.*admin|admin/);
  const ui = readFileSync(new URL("../../components/seguranca/duas-etapas.tsx", import.meta.url), "utf8");
  assert.ok(!ui.includes("createAdminClient"));
});

test("rota /admin/2fa/refazer é a única aberta a admin em aal1; o resto de /admin segue fechado", async () => {
  const { rotaLivreDeAal2 } = await import("../admin/mfa.ts");
  assert.equal(rotaLivreDeAal2("/admin/2fa/refazer"), true);
  assert.equal(rotaLivreDeAal2("/admin"), false);
  assert.equal(rotaLivreDeAal2("/admin/2fa/refazer/../financeiro"), false);
  assert.equal(rotaLivreDeAal2("/admin/financeiro"), false);
  const proxy = readFileSync(new URL("../../proxy.ts", import.meta.url), "utf8");
  assert.match(proxy, /mfaAdminObrigatoria\(\) && !rotaLivreDeAal2\(pathname\)/);
  const pagina = readFileSync(new URL("../../app/admin/2fa/refazer/page.tsx", import.meta.url), "utf8");
  assert.match(pagina, /perfil\?\.role !== "admin"\) notFound\(\)/);
});

test("refazer: ações exigem admin, senha recente e código do e-mail (hash, validade, limite)", () => {
  const src = readFileSync(new URL("./recuperacao-actions.ts", import.meta.url), "utf8");
  const trecho = src.slice(src.indexOf("export async function confirmarRefazer"));
  assert.match(trecho, /role.*!== "admin"/);
  assert.match(trecho, /senhaRecente/);
  assert.match(trecho, /refazerExpira > agora/);
  assert.match(trecho, /hashCodigoEmail/);
  assert.match(trecho, /aposFalha/);
});
