import { test } from "node:test";
import assert from "node:assert/strict";
import { createSign, generateKeyPairSync } from "node:crypto";
import {
  SELO_LINKEDIN,
  assinarCookie,
  avisoDeVencimentoDevido,
  conferirIdToken,
  desafioPkce,
  estadoSelo,
  hashDoSub,
  lerCookie,
  nomeCompativel,
  novoSegredoDoFluxo,
  redesVisiveisPara,
  retornoConfere,
  textoConectadoEm,
  validoAte,
  type ChavePublica,
} from "./regras.ts";
import { selosReais } from "../perfil/perfil-publico.ts";

test("63-B nomeCompativel: acentos e caixa, sobrenome composto, nome do meio, divergência", () => {
  assert.ok(nomeCompativel("José Antônio da Conceição", { given_name: "Jose", family_name: "CONCEICAO" }));
  assert.ok(nomeCompativel("Maria Silva", { given_name: "Maria", family_name: "da Silva Santos" }), "sobrenome composto");
  assert.ok(nomeCompativel("Ana Clara Lima Souza", { given_name: "Ana", family_name: "Souza" }), "nome do meio só na conta");
  assert.ok(nomeCompativel("Ana Souza", { given_name: "Ana Clara", family_name: "Souza" }), "nome do meio só no LinkedIn");
  assert.equal(nomeCompativel("Ana Clara Lima", { given_name: "Ana Clara", family_name: "Souza" }), false, "nome do meio não é sobrenome");
  assert.equal(nomeCompativel("Pedro Souza", { given_name: "Paulo", family_name: "Souza" }), false, "1º nome diferente");
  assert.equal(nomeCompativel("Pedro Souza", { given_name: "Pedro", family_name: "Lima" }), false, "nenhum sobrenome em comum");
  assert.equal(nomeCompativel("Pedro da Silva", { given_name: "Pedro", family_name: "da Costa" }), false, "partícula não conta");
  assert.equal(nomeCompativel("Pedro", { given_name: "Pedro", family_name: "Souza" }), false, "conta sem sobrenome");
  assert.equal(nomeCompativel("Pedro Souza", { given_name: "", family_name: "" }), false);
});

test("63-B state/nonce/PKCE: cookie assinado de 10 min, mesma conta, mesmo state", () => {
  const chave = "segredo-de-teste";
  const agora = new Date("2026-10-23T12:00:00Z");
  const s = novoSegredoDoFluxo("uid-1", agora);
  const c = assinarCookie(s, chave);
  assert.deepEqual(lerCookie(c, chave, agora), s);
  assert.equal(lerCookie(c, "outra-chave", agora), null, "assinatura errada");
  assert.equal(lerCookie(c.replace(/^./, "x"), chave, agora), null, "corpo adulterado");
  assert.equal(lerCookie(c, chave, new Date(agora.getTime() + 11 * 60_000)), null, "vencido (10 min)");
  assert.equal(lerCookie("", chave, agora), null);
  const lido = lerCookie(c, chave, agora);
  assert.ok(retornoConfere(lido, { state: s.state, uid: "uid-1" }));
  assert.equal(retornoConfere(lido, { state: "outro", uid: "uid-1" }), false, "state inválido");
  assert.equal(retornoConfere(lido, { state: s.state, uid: "uid-2" }), false, "outra sessão");
  assert.equal(retornoConfere(null, { state: s.state, uid: "uid-1" }), false, "sem cookie");
  // PKCE S256 (vetor da RFC 7636).
  assert.equal(desafioPkce("dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk"), "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM");
});

const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const jwk = { ...(publicKey.export({ format: "jwk" }) as ChavePublica), kid: "k1", alg: "RS256", use: "sig" };
function token(dados: Record<string, unknown>, cab: Record<string, unknown> = { alg: "RS256", kid: "k1" }): string {
  const p1 = Buffer.from(JSON.stringify(cab)).toString("base64url");
  const p2 = Buffer.from(JSON.stringify(dados)).toString("base64url");
  const ass = createSign("RSA-SHA256").update(`${p1}.${p2}`).sign(privateKey).toString("base64url");
  return `${p1}.${p2}.${ass}`;
}

test("63-B id_token: assinatura, iss, aud, exp e nonce; só sub, given_name e family_name saem", () => {
  const agora = new Date("2026-10-23T12:00:00Z");
  const t = Math.floor(agora.getTime() / 1000);
  const base = { iss: "https://www.linkedin.com/oauth", aud: "cliente", sub: "abc", given_name: "Ana", family_name: "Souza", email: "ana@x.com", picture: "p", exp: t + 300, iat: t, nonce: "n1" };
  const p = { chaves: [jwk], iss: "https://www.linkedin.com/oauth", aud: "cliente", nonce: "n1", agora };
  assert.deepEqual(conferirIdToken(token(base), p), { ok: true, sub: "abc", given_name: "Ana", family_name: "Souza" });
  assert.deepEqual(conferirIdToken(token({ ...base, aud: "outro" }), p), { ok: false, erro: "aud" });
  assert.deepEqual(conferirIdToken(token({ ...base, iss: "https://evil" }), p), { ok: false, erro: "iss" });
  assert.deepEqual(conferirIdToken(token({ ...base, exp: t - 3600 }), p), { ok: false, erro: "exp" });
  assert.deepEqual(conferirIdToken(token({ ...base, nonce: "outro" }), p), { ok: false, erro: "nonce" });
  assert.deepEqual(conferirIdToken(token(base, { alg: "none" }), p), { ok: false, erro: "alg" });
  assert.deepEqual(conferirIdToken(token(base, { alg: "RS256", kid: "x" }), p), { ok: false, erro: "chave" });
  const outro = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const falso = token(base).split(".").slice(0, 2).join(".") + "." + createSign("RSA-SHA256").update("x").sign(outro.privateKey).toString("base64url");
  assert.deepEqual(conferirIdToken(falso, p), { ok: false, erro: "assinatura" });
  assert.deepEqual(conferirIdToken("nao.e.jwt", p), { ok: false, erro: "formato" });
});

test("63-B um LinkedIn por conta: o banco só guarda o hash do sub (o mesmo sub dá o mesmo hash em qualquer conta)", () => {
  const h1 = hashDoSub("sub-x", "segredo");
  assert.equal(h1, hashDoSub("sub-x", "segredo"));
  assert.notEqual(h1, hashDoSub("sub-y", "segredo"));
  assert.notEqual(h1, hashDoSub("sub-x", "outro"));
  assert.doesNotMatch(h1, /sub-x/);
  assert.match(h1, /^[0-9a-f]{64}$/);
});

test("63-B 12 meses de validade, vencido some, aviso 30 dias antes uma vez só", () => {
  const conectado = new Date("2026-01-15T10:00:00Z");
  const vence = validoAte(conectado);
  assert.equal(vence.toISOString(), "2027-01-15T10:00:00.000Z");
  const linha = { conectado_em: conectado.toISOString(), valido_ate: vence.toISOString() };
  assert.deepEqual(estadoSelo(linha, new Date("2026-06-01")), { conectado: true, conectadoEm: linha.conectado_em, validoAte: linha.valido_ate });
  assert.equal(estadoSelo(linha, new Date("2027-01-16")), null, "vencido = sem selo");
  assert.equal(estadoSelo(null), null, "desconectado (linha apagada) = sem selo");
  assert.equal(avisoDeVencimentoDevido(linha, new Date("2026-12-01T00:00:00Z")), false, "ainda longe");
  assert.equal(avisoDeVencimentoDevido(linha, new Date("2026-12-20T00:00:00Z")), true, "dentro dos 30 dias");
  assert.equal(avisoDeVencimentoDevido({ ...linha, aviso_em: "2026-12-20T00:00:00Z" }, new Date("2026-12-25T00:00:00Z")), false, "já avisado");
  assert.equal(avisoDeVencimentoDevido(linha, new Date("2027-02-01")), false, "já vencido");
  assert.equal(textoConectadoEm("2026-10-23T15:00:00Z"), "Conectado em 23/10/2026");
});

test("63-B o selo é só o texto: sem link, nome nem foto do LinkedIn", () => {
  assert.equal(SELO_LINKEDIN, "LinkedIn conectado");
  assert.deepEqual(selosReais({ emailConfirmado: true, linkedinConectado: true }), ["E-mail confirmado", "LinkedIn conectado"]);
  assert.deepEqual(selosReais({ emailConfirmado: true, linkedinConectado: false }), ["E-mail confirmado"]);
  for (const s of selosReais({ linkedinConectado: true })) assert.doesNotMatch(s, /https?:|linkedin\.com|\//);
});

test("63-B redes de pessoas: chave desligada esconde; ligada, só a própria pessoa e a equipe (nunca outro usuário)", () => {
  assert.equal(redesVisiveisPara({ chaveLigada: false, quemVe: "u1", dono: "u1" }), false);
  assert.equal(redesVisiveisPara({ chaveLigada: true, quemVe: "u1", dono: "u1" }), true);
  assert.equal(redesVisiveisPara({ chaveLigada: true, quemVe: "u2", dono: "u1" }), false, "outro usuário, mesmo depois do contrato");
  assert.equal(redesVisiveisPara({ chaveLigada: true, quemVe: null, dono: "u1" }), false, "visitante");
  assert.equal(redesVisiveisPara({ chaveLigada: true, quemVe: "adm", dono: "u1", admin: true }), true, "atendimento");
});
