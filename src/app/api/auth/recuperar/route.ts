import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ipHash, situacaoLimite } from "@/lib/limites";
import { isValidEmail } from "@/lib/auth-errors";
import { avaliarEnvioCodigo, MSG_MUITOS_ENVIOS } from "@/lib/seguranca/codigo-acesso";
import { contaDeTeste, enviarRecuperacaoPorCodigo } from "@/lib/auth/recuperar-senha";

export const dynamic = "force-dynamic";

/**
 * E917 (opção A, decisão do Gerente 16/11) — "Esqueci minha senha" das CONTAS DE TESTE.
 * - Conta de teste (profiles.is_teste): o código de 6 dígitos sai pelo nosso envio (sendEmail) e por isso aparece na caixa
 *   de teste; a pessoa digita em /auth/reset/codigo. Nenhum link é guardado (E163). Resposta { ok: true, porCodigo: true,
 *   codigo } — o código aparece na tela de /auth/reset/codigo (prova de 19/11: a caixa de teste pede sessão).
 * - Qualquer outro e-mail: { ok: true, porCodigo: false } e NADA acontece aqui — a tela segue com o MESMO pedido de
 *   sempre ao Supabase (resetPasswordForEmail no navegador, com o CAPTCHA). Conta real não muda em nada.
 */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { email?: unknown };
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase().slice(0, 254) : "";
  if (!isValidEmail(email)) return NextResponse.json({ ok: false, error: "Digite um e-mail válido para receber o link." }, { status: 400 });

  const admin = createAdminClient();
  const teste = admin ? await contaDeTeste(admin, email) : null;
  if (!teste || !admin) return NextResponse.json({ ok: true, porCodigo: false });

  const emailHash = crypto.createHash("sha256").update(`recuperar:${email}`).digest("hex").slice(0, 32);
  if (!(await avaliarEnvioCodigo(emailHash, ipHash(request), situacaoLimite))) {
    return NextResponse.json({ ok: false, error: MSG_MUITOS_ENVIOS }, { status: 429, headers: { "Retry-After": "3600" } });
  }
  const codigo = await enviarRecuperacaoPorCodigo(admin, email, teste.id);
  if (!codigo) {
    return NextResponse.json({ ok: false, error: "Não foi possível enviar agora. Tente de novo em instantes." }, { status: 503 });
  }
  // E917 (prova de 19/11): conta de TESTE — o código também volta na resposta para aparecer na tela (a caixa de teste
  // pede sessão, e quem esqueceu a senha não a tem). Só profiles.is_teste; conta real nunca chega aqui.
  return NextResponse.json({ ok: true, porCodigo: true, codigo }, { headers: { "Cache-Control": "no-store" } });
}
