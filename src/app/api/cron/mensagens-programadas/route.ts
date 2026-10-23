import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { integracoesSimuladas } from "@/lib/integracoes";
import { enviarProgramadas } from "@/lib/respostas/servidor";

/**
 * Prompt 55-E2 — envio das mensagens programadas pelo dono. Chamada de hora em hora pelo PRÓPRIO banco (pg_cron + pg_net,
 * 0230) e 1×/dia pela Vercel (reserva). Nada sai entre 22h e 7h (Brasília). Exige `Authorization: Bearer <CRON_SECRET>`.
 * Só no laboratório: `?agora=<ISO>` roda com a data simulada.
 */
export async function GET(request: Request) {
  const segredo = process.env.CRON_SECRET;
  if (!segredo) return NextResponse.json({ error: "CRON_SECRET não configurado." }, { status: 503 });
  if (request.headers.get("authorization") !== `Bearer ${segredo}`) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: "Serviço indisponível." }, { status: 503 });
  const simulada = integracoesSimuladas() ? new URL(request.url).searchParams.get("agora") : null;
  const agora = simulada && Number.isFinite(Date.parse(simulada)) ? new Date(simulada) : new Date();
  const r = await enviarProgramadas(admin, agora);
  return NextResponse.json({ ok: true, agora: agora.toISOString(), ...r });
}
