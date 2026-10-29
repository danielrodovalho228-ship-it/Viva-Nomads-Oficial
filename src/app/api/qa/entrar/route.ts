import { NextResponse } from "next/server";
import { ipHash } from "@/lib/limites";
import { entrarComoQa, qaLoginLigado } from "@/lib/qa/entrar-servidor";

export const dynamic = "force-dynamic";

/*
  QA-LOGIN-B — POST { email, chave, papel? }: a QA entra numa conta de teste sem código por e-mail (docs/qa-login.md).
  Tudo o que não passa nas travas responde 404 com o mesmo corpo: a rota não revela que existe.
  A chave só vem no corpo do POST; nunca na URL, nunca no log, nunca na resposta.
*/
const naoEncontrado = () => NextResponse.json({ ok: false }, { status: 404, headers: { "Cache-Control": "no-store" } });

export async function POST(request: Request) {
  if (!qaLoginLigado()) return naoEncontrado();
  const corpo = (await request.json().catch(() => ({}))) as { email?: unknown; chave?: unknown; papel?: unknown };
  const r = await entrarComoQa({ email: corpo.email, chave: corpo.chave, papel: corpo.papel }, ipHash(request));
  if (r.status === 200) return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  if (r.status === 404) return naoEncontrado();
  return NextResponse.json({ ok: false }, { status: r.status, headers: { "Cache-Control": "no-store" } });
}

export function GET() {
  return naoEncontrado();
}
