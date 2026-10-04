import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { consumirLimite, ipHash, HORA } from "@/lib/limites";

/**
 * "Este e-mail tem conta?" — usado SÓ depois de um login recusado, para dizer
 * "crie sua conta" em vez de "senha incorreta". A RPC email_existe saiu do
 * alcance de anon/authenticated (0062: enumeração de e-mails); aqui ela roda
 * pelo servidor com limite por IP. Estourou o limite ou sem backend → null
 * (a tela mostra a mensagem genérica).
 */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { email?: unknown } | null;
  const email = typeof body?.email === "string" ? body.email.trim().slice(0, 254) : "";
  if (!email || !email.includes("@")) return NextResponse.json({ existe: null }, { status: 400 });

  if (!(await consumirLimite(`email-existe:${ipHash(request)}`, 10, HORA))) {
    return NextResponse.json({ existe: null }, { status: 429 });
  }
  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ existe: null });
  const { data, error } = await admin.rpc("email_existe", { e: email });
  if (error) return NextResponse.json({ existe: null });
  return NextResponse.json({ existe: data === true });
}
