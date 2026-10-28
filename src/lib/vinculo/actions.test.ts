import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const src = readFileSync(new URL("./actions.ts", import.meta.url), "utf8");
const corpo = (nome: string) => src.slice(src.indexOf(`export async function ${nome}`));

test("as duas ações exigem sessão e usam o id da sessão, nunca um id vindo da tela", () => {
  assert.match(src, /^"use server";/);
  for (const n of ["pedirVinculo", "confirmarVinculo"]) {
    const c = corpo(n).slice(0, 600);
    assert.match(c, /await sessao\(\)/, n);
    assert.match(c, /if \(!s \|\| !admin\)/, n);
  }
});

test("o pedido recusa e-mail gratuito ANTES de gravar ou enviar, e tem limite por pessoa", () => {
  const c = corpo("pedirVinculo");
  assert.ok(c.indexOf("dominioCorporativo(") < c.indexOf("consumirLimite("));
  assert.ok(c.indexOf("consumirLimite(") < c.indexOf(".upsert("));
  assert.ok(c.indexOf(".upsert(") < c.indexOf("sendEmail("));
});

test("o código e o e-mail inteiro nunca vão para o banco nem voltam na resposta", () => {
  const c = corpo("pedirVinculo");
  assert.match(c, /codigo_hash: hashDoCodigo\(/);
  assert.doesNotMatch(c, /codigo:\s*codigo|return \{ ok: true[^}]*codigo/);
  assert.doesNotMatch(c, /email:\s*emailBruto/);
  assert.match(c, /return \{ ok: true, dominio: d\.dominio \}/);
});

test("palpite errado conta tentativa e a confirmação é de uso único", () => {
  const c = corpo("confirmarVinculo");
  assert.match(c, /\.update\(\{ tentativas: tentativas \+ 1 \}\)[\s\S]*\.eq\("tentativas", tentativas\)/);
  assert.match(c, /confirmado_em: new Date\(\)\.toISOString\(\), tentativas: MAX_TENTATIVAS/);
  assert.match(c, /\.eq\("codigo_hash"/);
});

test("o e-mail do código existe, diz a validade real (15 minutos) e não fala de duas etapas", async () => {
  const { emailCodigoVinculo } = await import("../notifications/montar-email.ts");
  const m = emailCodigoVinculo("https://vivanomads.com.br", { codigo: "042917" });
  assert.match(m.text, /042917/);
  assert.match(m.html, /15 minutos/);
  assert.doesNotMatch(m.html + m.text, /duas etapas|vistoria|apartamento/i);
  assert.match(m.assunto, /· Viva Nomads$/);
});

test("meuVinculo lê só a linha da sessão e só devolve o domínio quando confirmado", () => {
  const c = corpo("meuVinculo");
  assert.match(c, /await sessao\(\)/);
  assert.match(c, /\.eq\("user_id", s\.user\.id\)/);
  assert.match(c, /data\?\.confirmado_em \? \{ dominio/);
  assert.doesNotMatch(c, /codigo_hash/);
});

test("actions.ts exporta só funções (arquivo use server); as frases ficam em textos.ts", () => {
  assert.doesNotMatch(src, /^export const /m);
  assert.match(src, /from "\.\/textos"/);
});
