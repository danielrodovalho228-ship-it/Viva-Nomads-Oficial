import test from "node:test";
import assert from "node:assert/strict";
import { verificarCaptchaServidor, MSG_CAPTCHA_RECUSADO } from "./captcha-servidor.ts";

const chaves = { chavePublica: "0x4AAA", segredo: "segredo" };
const ok = async () => ({ json: async () => ({ success: true }) });
const nok = async () => ({ json: async () => ({ success: false }) });

test("captcha do chamado: sem as chaves libera (laboratório, dev, preview)", async () => {
  assert.deepEqual(await verificarCaptchaServidor(null), { ok: true });
  assert.deepEqual(await verificarCaptchaServidor(null, { chavePublica: "0x4AAA" }), { ok: true });
});

test("captcha do chamado: ligado, sem token ou token curto demais é recusado sem chamar a Cloudflare", async () => {
  const boom = async () => { throw new Error("não devia chamar"); };
  assert.deepEqual(await verificarCaptchaServidor(null, { ...chaves, fetcher: boom }), { ok: false, error: MSG_CAPTCHA_RECUSADO });
  assert.deepEqual(await verificarCaptchaServidor("abc", { ...chaves, fetcher: boom }), { ok: false, error: MSG_CAPTCHA_RECUSADO });
});

test("captcha do chamado: token inválido ou falha de rede é recusado; token válido passa", async () => {
  const token = "token-qualquer-bem-grande";
  assert.equal((await verificarCaptchaServidor(token, { ...chaves, fetcher: nok })).ok, false);
  assert.equal((await verificarCaptchaServidor(token, { ...chaves, fetcher: async () => { throw new Error("rede"); } })).ok, false);
  assert.equal((await verificarCaptchaServidor(token, { ...chaves, fetcher: ok })).ok, true);
});

test("captcha do chamado: abrirChamado confere o token só do visitante e os dois formulários o enviam", async () => {
  const { readFileSync } = await import("node:fs");
  const acoes = readFileSync("src/lib/data/atendimento-actions.ts", "utf8");
  assert.match(acoes, /if \(!user\) \{[\s\S]{0,400}verificarCaptchaServidor\(input\.captchaToken/);
  for (const f of ["src/components/ajuda/central-ajuda.tsx", "src/components/ajuda/viva-chat.tsx"]) {
    const t = readFileSync(f, "utf8");
    assert.match(t, /useCaptcha\(\)/, f);
    assert.match(t, /captchaToken:/, f);
    assert.match(t, /captcha\.reset\(\)/, f);
  }
});
