import { NextResponse } from "next/server";
import { sendEmail, isEmailConfigured } from "@/lib/notifications/email";
import { sampleEmails } from "@/lib/notifications/templates";

/**
 * Envia e-mail(s) de teste para validar a integração Resend.
 * Uso (no deploy, com RESEND_API_KEY configurado):
 *   GET /api/test-email?to=voce@x          → 1 e-mail de teste simples
 *   GET /api/test-email?to=voce@x&all=1    → 1 exemplo de CADA template branded
 *
 * Observação: estes são os e-mails TRANSACIONAIS (Resend). Os e-mails de LOGIN
 * (confirmação, reset, etc.) são enviados pelo Supabase Auth e disparam pela
 * ação no site — aqui mandamos as mesmas artes só para revisar o visual.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const to = searchParams.get("to") ?? "dtrodovalho40@gmail.com";
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
    // Envia um exemplo de cada modelo branded para revisão visual.
    const samples = sampleEmails();
    const sent = [];
    for (const s of samples) {
      const r = await sendEmail({ to, subject: `[TESTE] ${s.subject}`, html: s.html });
      sent.push({ key: s.key, ok: !r.error, demo: r.demo, id: r.id, error: r.error });
    }
    return NextResponse.json({ ok: sent.every((s) => s.ok), to, count: sent.length, sent });
  }

  const result = await sendEmail({
    to,
    subject: "Viva Nomads — e-mail de teste ✅",
    html: sampleEmails()[0].html, // arte branded de confirmação como teste simples
  });

  return NextResponse.json({
    ok: !result.error,
    demo: result.demo,
    id: result.id,
    error: result.error,
    to,
    dica: "Para receber um exemplo de CADA template, adicione &all=1 no fim da URL.",
  });
}
