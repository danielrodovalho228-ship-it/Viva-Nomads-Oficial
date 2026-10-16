import test from "node:test";
import assert from "node:assert/strict";
import { dominioExiste, type ResolvedorDns } from "./email-dominio-dns.ts";
import { validarVisitanteComDns } from "./atendimento/identificacao-chamado-dns.ts";

const erro = (code: string) => Object.assign(new Error(code), { code });
const resolvedor = (mx: () => Promise<unknown[]>, a: () => Promise<unknown[]>): ResolvedorDns => ({ resolveMx: mx, resolve4: a });
const semDominio = resolvedor(() => Promise.reject(erro("ENOTFOUND")), () => Promise.reject(erro("ENOTFOUND")));
const comMx = resolvedor(() => Promise.resolve([{ exchange: "mx.x.com", priority: 1 }]), () => Promise.reject(erro("ENODATA")));
const redeCaiu = resolvedor(() => Promise.reject(erro("ETIMEOUT")), () => Promise.reject(erro("ETIMEOUT")));

test("MX: domínio inexistente reprova; com MX ou só com A passa; falha de rede deixa passar", async () => {
  assert.equal(await dominioExiste("nao-existe.invalido", semDominio), false);
  assert.equal(await dominioExiste("gmail.com", comMx), true);
  assert.equal(await dominioExiste("so-a.com", resolvedor(() => Promise.reject(erro("ENODATA")), () => Promise.resolve(["1.2.3.4"]))), true);
  assert.equal(await dominioExiste("x.com", redeCaiu), true);
});

test("F24: chamado deslogado recusa domínio sem MX com a mesma mensagem do cadastro (ordem 8e720f03)", async () => {
  const r = await validarVisitanteComDns({ nome: "Ana", email: "ana@dominio-fantasma-xyz.com" }, semDominio);
  assert.equal(r.ok, false);
  if (!r.ok) assert.match(r.error, /Não conseguimos usar este e-mail/);
});

test("F24: domínio com MX passa; erros simples continuam sem consultar o DNS", async () => {
  const r = await validarVisitanteComDns({ nome: "Ana", email: "Ana@Gmail.com" }, comMx);
  assert.deepEqual(r, { ok: true, nome: "Ana", email: "ana@gmail.com" });
  const boom = resolvedor(() => { throw new Error("não devia consultar"); }, () => { throw new Error("não devia consultar"); });
  assert.equal((await validarVisitanteComDns({ nome: "", email: "a@gmail.com" }, boom)).ok, false);
  assert.equal((await validarVisitanteComDns({ nome: "Ana", email: "ana@example.com" }, boom)).ok, false);
});

test("F24: o domínio das contas do laboratório não depende de DNS", async () => {
  const r = await validarVisitanteComDns({ nome: "Ana", email: "visitante@lab.vivanomads.com.br" }, semDominio);
  assert.equal(r.ok, true);
});
