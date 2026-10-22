import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { integracoesSimuladas } from "@/lib/integracoes";
import { rodarPrazos59 } from "@/lib/prazos-59-servidor";

/**
 * Prompt 59 — prazos do padrão mínimo e da solução da manutenção. Chamado a cada 15 min pelo PRÓPRIO banco (pg_cron +
 * pg_net, 0210) e 1×/dia pela Vercel (reserva). Exige `Authorization: Bearer <CRON_SECRET>`.
 * Só no laboratório (INTEGRACOES_SIMULADAS=on, nunca em produção): `?agora=<ISO>` roda com a data simulada.
 */
export async function GET(request: Request) {
  const segredo = process.env.CRON_SECRET;
  if (!segredo) return NextResponse.json({ error: "CRON_SECRET não configurado." }, { status: 503 });
  if (request.headers.get("authorization") !== `Bearer ${segredo}`) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: "Serviço indisponível." }, { status: 503 });
  const simulada = integracoesSimuladas() ? new URL(request.url).searchParams.get("agora") : null;
  const agora = simulada && Number.isFinite(Date.parse(simulada)) ? new Date(simulada) : new Date();
  const resumo = await rodarPrazos59(admin, agora);
  return NextResponse.json({ ok: true, agora: agora.toISOString(), ...resumo });
}
