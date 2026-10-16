import { NextResponse } from "next/server";
import { dominioDoEmail, dominioReservado, MSG_EMAIL_INUTILIZAVEL } from "@/lib/email-dominio";
import { dominioExiste } from "@/lib/email-dominio-dns";
import { situacaoLimite, ipHash } from "@/lib/limites";

export const dynamic = "force-dynamic";

/** Pré-cadastro: não escreve nada, só responde se o domínio do e-mail pode receber mensagem. */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { email?: unknown };
  const email = typeof body.email === "string" ? body.email.slice(0, 254) : "";
  const dominio = dominioDoEmail(email);
  if (!dominio || dominioReservado(dominio)) {
    return NextResponse.json({ ok: false, error: MSG_EMAIL_INUTILIZAVEL });
  }
  if ((await situacaoLimite(`validar-email:ip:${ipHash(request)}`, 30, 3600)) === "estourou") {
    return NextResponse.json({ ok: false, error: "Muitas tentativas. Aguarde um instante e tente de novo." }, { status: 429 });
  }
  if (!(await dominioExiste(dominio))) {
    return NextResponse.json({ ok: false, error: MSG_EMAIL_INUTILIZAVEL });
  }
  return NextResponse.json({ ok: true });
}
