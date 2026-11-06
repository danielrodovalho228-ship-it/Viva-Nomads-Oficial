import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { integracoesSimuladas } from "@/lib/integracoes";
import { CAUCAO_PRAZOS_ATIVA } from "@/lib/flags";
import { rodarCaucaoPrazos } from "@/lib/caucao/prazos-servidor";

/**
 * E637 — prazos da caução (1×/dia pela Vercel). Exige `Authorization: Bearer <CRON_SECRET>`. ATRÁS DA CHAVE
 * CAUCAO_PRAZOS_ATIVA (desligada): sem ela, responde ok e não faz nada. Só no laboratório (INTEGRACOES_SIMULADAS=on): `?agora=<ISO>`.
 */
export async function GET(request: Request) {
  const segredo = process.env.CRON_SECRET;
  if (!segredo) return NextResponse.json({ error: "CRON_SECRET não configurado." }, { status: 503 });
  if (request.headers.get("authorization") !== `Bearer ${segredo}`) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  if (!CAUCAO_PRAZOS_ATIVA) return NextResponse.json({ ok: true, ativa: false });
  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: "Serviço indisponível." }, { status: 503 });
  const simulada = integracoesSimuladas() ? new URL(request.url).searchParams.get("agora") : null;
  const agora = simulada && Number.isFinite(Date.parse(simulada)) ? new Date(simulada) : new Date();
  const resumo = await rodarCaucaoPrazos(admin, agora);
  return NextResponse.json({ ok: true, agora: agora.toISOString(), ...resumo });
}
