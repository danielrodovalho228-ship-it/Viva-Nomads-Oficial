#!/usr/bin/env node
/*
  LinkedIn FALSO do laboratório (63-B). OIDC mínimo no formato do LinkedIn: o site do laboratório, com
  INTEGRACOES_SIMULADAS=on e LAB_LINKEDIN_URL apontando para cá, manda a pessoa para /oauth/v2/authorization, troca o code
  em /oauth/v2/accessToken (confere client_id/secret, redirect_uri e o PKCE S256) e confere o id_token pela chave de
  /oauth/openid/jwks. O id_token é RS256 de verdade, com iss, aud, exp, nonce, sub, given_name e family_name. Nada sai
  para a rede.

  Controle (só para os testes):
    POST /__identidade   → { sub, given_name, family_name } vale para as próximas autorizações (padrão: Lab Teste)
    POST /__limpar       → volta à identidade padrão e zera os codes

  Uso: node scripts/lab/linkedin-falso.mjs [porta]   (padrão 3997; só escuta em 127.0.0.1)
*/
import { createServer } from "node:http";
import { createHash, createSign, generateKeyPairSync, randomBytes } from "node:crypto";

const porta = Number(process.argv[2] ?? process.env.LAB_LINKEDIN_PORTA ?? 3997);
const base = `http://127.0.0.1:${porta}`;
const ISS = `${base}/oauth`;
const CLIENTE = "lab-cliente";
const SEGREDO = "lab-segredo";
const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const JWK = { ...publicKey.export({ format: "jwk" }), kid: "lab-1", alg: "RS256", use: "sig" };
const PADRAO = { sub: "lab-sub-padrao", given_name: "Lab", family_name: "Teste" };
let identidade = { ...PADRAO };
const codes = new Map();

const b64url = (b) => Buffer.from(b).toString("base64url");
function idToken(dados) {
  const cab = b64url(JSON.stringify({ alg: "RS256", kid: JWK.kid, typ: "JWT" }));
  const corpo = b64url(JSON.stringify(dados));
  const ass = createSign("RSA-SHA256").update(`${cab}.${corpo}`).sign(privateKey).toString("base64url");
  return `${cab}.${corpo}.${ass}`;
}
const json = (res, status, corpo) => {
  res.writeHead(status, { "Content-Type": "application/json", "Cache-Control": "no-store" });
  res.end(JSON.stringify(corpo));
};
const lerCorpo = (req) =>
  new Promise((ok) => {
    let s = "";
    req.on("data", (c) => (s += c));
    req.on("end", () => ok(s));
  });

createServer(async (req, res) => {
  const url = new URL(req.url, base);
  if (req.method === "GET" && url.pathname === "/oauth/v2/authorization") {
    const q = url.searchParams;
    if (q.get("response_type") !== "code" || q.get("client_id") !== CLIENTE || !q.get("redirect_uri") || !q.get("state") || q.get("code_challenge_method") !== "S256" || !q.get("code_challenge")) {
      return json(res, 400, { error: "invalid_request" });
    }
    if (!(q.get("scope") ?? "").split(" ").includes("openid")) return json(res, 400, { error: "invalid_scope" });
    const code = b64url(randomBytes(18));
    codes.set(code, { nonce: q.get("nonce"), desafio: q.get("code_challenge"), retorno: q.get("redirect_uri"), id: { ...identidade } });
    const volta = new URL(q.get("redirect_uri"));
    volta.searchParams.set("code", code);
    volta.searchParams.set("state", q.get("state"));
    res.writeHead(302, { Location: volta.toString() });
    return res.end();
  }
  if (req.method === "POST" && url.pathname === "/oauth/v2/accessToken") {
    const f = new URLSearchParams(await lerCorpo(req));
    const c = codes.get(f.get("code") ?? "");
    codes.delete(f.get("code") ?? "");
    if (!c || f.get("grant_type") !== "authorization_code") return json(res, 400, { error: "invalid_grant" });
    if (f.get("client_id") !== CLIENTE || f.get("client_secret") !== SEGREDO) return json(res, 401, { error: "invalid_client" });
    if (f.get("redirect_uri") !== c.retorno) return json(res, 400, { error: "invalid_grant", error_description: "redirect_uri" });
    const desafio = createHash("sha256").update(f.get("code_verifier") ?? "").digest("base64url");
    if (desafio !== c.desafio) return json(res, 400, { error: "invalid_grant", error_description: "pkce" });
    const agora = Math.floor(Date.now() / 1000);
    return json(res, 200, {
      access_token: b64url(randomBytes(24)),
      expires_in: 3600,
      scope: "openid profile",
      token_type: "Bearer",
      id_token: idToken({ iss: ISS, aud: CLIENTE, iat: agora, exp: agora + 3600, nonce: c.nonce, ...c.id, picture: "https://media.licdn.com/lab.jpg", email: "nao-pedido@lab.invalid" }),
    });
  }
  if (req.method === "GET" && url.pathname === "/oauth/openid/jwks") return json(res, 200, { keys: [JWK] });
  if (req.method === "POST" && url.pathname === "/__identidade") {
    const d = JSON.parse((await lerCorpo(req)) || "{}");
    identidade = { sub: String(d.sub ?? PADRAO.sub), given_name: String(d.given_name ?? ""), family_name: String(d.family_name ?? "") };
    return json(res, 200, { ok: true });
  }
  if (req.method === "POST" && url.pathname === "/__limpar") {
    identidade = { ...PADRAO };
    codes.clear();
    return json(res, 200, { ok: true });
  }
  return json(res, 404, { error: "not_found" });
}).listen(porta, "127.0.0.1", () => console.log(`LinkedIn falso em ${base}`));
