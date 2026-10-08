import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { rodarAvisosDaniel } from "@/lib/agentes/avisos-daniel-servidor";

/**
 * Avisos do Moacir ao Daniel por e-mail (0094). Chamado a cada 15 min pelo mesmo
 * agendador do /api/cron/atendimento e 1×/dia pelo cron da Vercel (19h de Brasília,
 * resumo do que passou do limite de 6 e-mails). Exige `Authorization: Bearer <CRON_SECRET>`;
 * sem o segredo, não roda. Sem AVISO_DANIEL_EMAIL, não envia e registra o erro na fila.
 */
export async function GET(request: Request) {
  const segredo = process.env.CRON_SECRET;
  if (!segredo) return NextResponse.json({ error: "CRON_SECRET não configurado." }, { status: 503 });
  if (request.headers.get("authorization") !== `Bearer ${segredo}`) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }
  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: "Serviço indisponível." }, { status: 503 });
  const r = await rodarAvisosDaniel(admin, segredo);
  return NextResponse.json({ ok: !r.erro, ...r });
}
