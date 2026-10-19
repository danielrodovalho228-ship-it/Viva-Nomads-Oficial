import { NextResponse } from "next/server";
import { sendEmail, isEmailConfigured } from "@/lib/notifications/email";
import { catalogoEmails, comFaixaDeTeste } from "@/lib/notifications/catalogo-emails";
import { SITE_URL } from "@/lib/site";
import { testRouteForbidden } from "@/lib/test-guard";

/**
 * Envia e-mail(s) de teste para validar a integração Resend.
 * Uso (no deploy, com RESEND_API_KEY configurado):
 *   GET /api/test-email?to=voce@x          → 1 e-mail de teste simples
 *   GET /api/test-email?to=voce@x&all=1    → 1 exemplo de CADA e-mail de cliente (catálogo completo)
 *
 * Observação: estes são os e-mails TRANSACIONAIS (Resend). Os e-mails de LOGIN
 * (confirmação, reset, etc.) são enviados pelo Supabase Auth e disparam pela
 * ação no site — aqui mandamos as mesmas artes só para revisar o visual.
 */
export async function GET(request: Request) {
  const blocked = testRouteForbidden(request);
  if (blocked) return blocked;

  const { searchParams } = new URL(request.url);
  const to = (searchParams.get("to") ?? "").trim();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to)) {
    return NextResponse.json({ ok: false, error: "Informe o destinatário: ?to=email@exemplo.com" }, { status: 400 });
  }
  const all = searchParams.get("all") === "1";

  if (!isEmailConfigured()) {
    return NextResponse.json({
      ok: false,
      demo: true,
      message:
        "RESEND_API_KEY não configurado. Defina a variável na Vercel e acesse esta rota no site publicado para enviar o(s) e-mail(s) de teste.",
      to,
    });
  }

  if (all) {
    // Um exemplo de CADA e-mail de cliente (app + conta), com o assunto real: a marca de teste é uma faixa no corpo.
    const sent = [];
    for (const s of catalogoEmails(SITE_URL)) {
      const r = await sendEmail({ to, subject: s.assunto, html: comFaixaDeTeste(s.html), text: s.text || undefined, imagem: s.imagem, evento: s.evento });
      sent.push({ key: s.chave, assunto: s.assunto, ok: !r.error, demo: r.demo, id: r.id, error: r.error });
    }
    return NextResponse.json({ ok: sent.every((s) => s.ok), to, count: sent.length, sent });
  }

  const primeiro = catalogoEmails(SITE_URL)[0];
  const result = await sendEmail({ to, subject: "E-mail de teste", html: comFaixaDeTeste(primeiro.html) });

  return NextResponse.json({
    ok: !result.error,
    demo: result.demo,
    id: result.id,
    error: result.error,
    to,
    dica: "Para receber um exemplo de CADA template, adicione &all=1 no fim da URL.",
  });
}
