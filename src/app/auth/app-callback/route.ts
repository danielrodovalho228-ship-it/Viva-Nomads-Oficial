import { NextResponse } from "next/server";
import { consumirLimite } from "@/lib/limites";
import { codigoValido, conferirStateLogin, provedorValido, segredoLoginApp, urlRetornoApp } from "@/lib/app/login-social";

/**
 * Ponte do login social no app (ordem 1f65c73d). O navegador do sistema volta do Google/Apple para cá
 * com ?code (PKCE) e ?state. Confere o state (assinado, 5 min, USO ÚNICO) e devolve ao app por
 * vivanomads://auth/callback. NÃO troca o code por sessão: o verificador PKCE está no WebView do app,
 * que faz a troca em /auth/callback. Falha: /auth, sem detalhes. Sem cache e sem referrer.
 */
function resposta(url: URL | string, status: number) {
  const res = NextResponse.redirect(url, status);
  res.headers.set("Cache-Control", "no-store");
  res.headers.set("Referrer-Policy", "no-referrer");
  return res;
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const code = params.get("code");
  const state = params.get("state");
  const provedor = provedorValido(params.get("provedor") ?? "google");
  const falha = () => resposta(new URL("/auth", request.url), 303);
  if (!provedor || !codigoValido(code) || !state) return falha();

  const nonce = conferirStateLogin(state, provedor, new Date(), segredoLoginApp());
  if (!nonce) return falha();
  // Uso único: a segunda chegada com o mesmo state estoura o limite (falha fechada).
  if (!(await consumirLimite(`login-social-uso:${nonce}`, 1, 600))) return falha();

  return resposta(urlRetornoApp(code, state), 303);
}
