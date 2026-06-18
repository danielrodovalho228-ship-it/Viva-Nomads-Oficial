import { NextResponse } from "next/server";
import { sendEmail, isEmailConfigured } from "@/lib/notifications/email";

/**
 * Envia um e-mail de teste para validar a integração Resend.
 * Uso (no deploy, com RESEND_API_KEY configurado):
 *   GET /api/test-email            → envia para o e-mail padrão
 *   GET /api/test-email?to=voce@x  → envia para o destinatário informado
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const to = searchParams.get("to") ?? "dtrodovalho40@gmail.com";

  if (!isEmailConfigured()) {
    return NextResponse.json({
      ok: false,
      demo: true,
      message:
        "RESEND_API_KEY não configurado. Defina a variável na Vercel e acesse esta rota no site publicado para enviar o e-mail de teste.",
      to,
    });
  }

  const result = await sendEmail({
    to,
    subject: "Viva Nomads — e-mail de teste ✅",
    html: `
      <div style="font-family:sans-serif;max-width:520px;margin:0 auto">
        <div style="background:#0A0A0A;border-radius:16px;padding:24px;text-align:center">
          <span style="font-size:24px;font-weight:800">
            <span style="color:#2E8BE6">Viva</span><span style="color:#6CBE2A">Nomads</span>
          </span>
        </div>
        <h2 style="color:#0f1722">Funcionou! 🎉</h2>
        <p style="color:#5b6573">
          Este é um e-mail de teste do Viva Nomads. Se você recebeu, a integração de
          e-mail transacional (Resend) está ativa — alertas de novos leads, mensagens e
          candidaturas serão enviados normalmente.
        </p>
      </div>`,
  });

  return NextResponse.json({
    ok: !result.error,
    demo: result.demo,
    id: result.id,
    error: result.error,
    to,
  });
}
