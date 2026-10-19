import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ipHash, situacaoLimite } from "@/lib/limites";
import { avaliarTentativaLogin, MSG_LOGIN_ESPERAR } from "@/lib/seguranca/limite-login";

export const dynamic = "force-dynamic";

/**
 * Entrar com e-mail e senha, com o atraso progressivo valendo no SERVIDOR
 * (o contador do navegador é só aviso). A sessão é gravada nos cookies aqui.
 * Credenciais inválidas: sempre o mesmo corpo, sem revelar se a conta existe.
 */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { email?: unknown; password?: unknown; captchaToken?: unknown };
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase().slice(0, 254) : "";
  const password = typeof body.password === "string" ? body.password.slice(0, 200) : "";
  const captchaToken = typeof body.captchaToken === "string" ? body.captchaToken.slice(0, 4096) : undefined;
  if (!email || !password) return NextResponse.json({ ok: false, codigo: "invalido" }, { status: 400 });

  const emailHash = crypto.createHash("sha256").update(`login:${email}`).digest("hex").slice(0, 32);
  const r = await avaliarTentativaLogin(emailHash, ipHash(request), situacaoLimite);
  if (!r.permitido) {
    return NextResponse.json(
      { ok: false, codigo: "espera", espera: r.esperaSegundos, error: MSG_LOGIN_ESPERAR },
      { status: 429, headers: { "Retry-After": String(r.esperaSegundos) } }
    );
  }

  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ ok: false, codigo: "indisponivel" }, { status: 503 });

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
    options: captchaToken ? { captchaToken } : undefined,
  });
  if (error || !data.user) {
    const m = (error?.message ?? "").toLowerCase();
    if (m.includes("not confirmed") || m.includes("confirm")) return NextResponse.json({ ok: false, codigo: "nao_confirmado" }, { status: 401 });
    if (m.includes("captcha")) return NextResponse.json({ ok: false, codigo: "captcha", error: error?.message }, { status: 401 });
    return NextResponse.json({ ok: false, codigo: "credenciais" }, { status: 401 });
  }
  const u = data.user;
  return NextResponse.json({
    ok: true,
    user: { id: u.id, email: u.email ?? "", fullName: (u.user_metadata?.full_name as string | undefined) ?? null, role: (u.user_metadata?.role as string | undefined) ?? "tenant" },
  });
}
