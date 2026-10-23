import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ipHash, situacaoLimite } from "@/lib/limites";
import { dominioDoEmail, dominioReservado, MSG_EMAIL_INUTILIZAVEL } from "@/lib/email-dominio";
import { dominioExiste } from "@/lib/email-dominio-dns";
import { isValidEmail } from "@/lib/auth-errors";
import { integracoesSimuladas, registrarSimulado } from "@/lib/integracoes";
import { avaliarEnvioCodigo, mensagemEnvioCodigo, MSG_MUITOS_ENVIOS } from "@/lib/seguranca/codigo-acesso";

export const dynamic = "force-dynamic";

/**
 * Prompt 49 — entrada única: envia o código de 6 dígitos (entra E cria conta; shouldCreateUser=true).
 * O limite vale AQUI, no servidor: 5 envios por hora por e-mail e por IP. Resposta neutra: o mesmo
 * { ok: true } com ou sem conta; só limite, CAPTCHA, e-mail que não recebe mensagem e falha aparecem.
 * Nenhuma conta nova cria senha. No laboratório (INTEGRACOES_SIMULADAS) nada sai para a rede: a conta
 * nasce pelo cliente de serviço e o envio vira linha no LAB_OUTBOX (o teste lê o código do Supabase local).
 */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { email?: unknown; captchaToken?: unknown; indicacao?: unknown };
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase().slice(0, 254) : "";
  const captchaToken = typeof body.captchaToken === "string" ? body.captchaToken.slice(0, 4096) : undefined;
  const indicacao = typeof body.indicacao === "string" ? body.indicacao.trim().slice(0, 40) || null : null;
  if (!isValidEmail(email)) return NextResponse.json({ ok: false, error: "Digite um e-mail válido para receber o código." }, { status: 400 });

  const dominio = dominioDoEmail(email);
  if (!dominio || dominioReservado(dominio) || !(await dominioExiste(dominio))) {
    return NextResponse.json({ ok: false, error: MSG_EMAIL_INUTILIZAVEL }, { status: 400 });
  }

  const emailHash = crypto.createHash("sha256").update(`codigo:${email}`).digest("hex").slice(0, 32);
  if (!(await avaliarEnvioCodigo(emailHash, ipHash(request), situacaoLimite))) {
    return NextResponse.json({ ok: false, error: MSG_MUITOS_ENVIOS }, { status: 429, headers: { "Retry-After": "3600" } });
  }

  if (integracoesSimuladas()) {
    const admin = createAdminClient();
    if (!admin) return NextResponse.json({ ok: false, error: "Não foi possível enviar o código agora." }, { status: 503 });
    const { error } = await admin.auth.admin.createUser({ email, email_confirm: true, user_metadata: indicacao ? { referred_by: indicacao } : {} });
    // Conta que já existe: segue igual (resposta neutra).
    if (error && !/already|registered|exists/i.test(error.message)) {
      return NextResponse.json({ ok: false, error: "Não foi possível enviar o código agora." }, { status: 503 });
    }
    await registrarSimulado("codigo-acesso", { para: email });
    return NextResponse.json({ ok: true });
  }

  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ ok: false, error: "Entrar por código não está disponível neste ambiente." }, { status: 503 });
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: true,
      ...(captchaToken ? { captchaToken } : {}),
      // Só vale para a conta nova (o Supabase ignora em conta existente).
      ...(indicacao ? { data: { referred_by: indicacao } } : {}),
    },
  });
  const msg = error ? mensagemEnvioCodigo(error.message || "") : null;
  if (msg) return NextResponse.json({ ok: false, error: msg }, { status: msg === MSG_MUITOS_ENVIOS ? 429 : /robô/.test(msg) ? 401 : 503 });
  return NextResponse.json({ ok: true });
}
