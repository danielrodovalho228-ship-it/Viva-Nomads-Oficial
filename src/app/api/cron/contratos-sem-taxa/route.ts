import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { integracoesSimuladas } from "@/lib/integracoes";
import { avisarContratosSemTaxa } from "@/lib/data/contratos-sem-taxa-servidor";

/**
 * E1205 (ORDEM-DUET-1012) — a varredura do contrato sem taxa reservada, de hora em hora (vercel.json). Exige
 * `Authorization: Bearer <CRON_SECRET>`. Não cobra nada: avisa o dono uma vez por contrato (a fila da Central lê a mesma
 * regra). Só no laboratório (INTEGRACOES_SIMULADAS=on): `?agora=<ISO>`.
 */
export async function GET(request: Request) {
  const segredo = process.env.CRON_SECRET;
  if (!segredo) return NextResponse.json({ error: "CRON_SECRET não configurado." }, { status: 503 });
  if (request.headers.get("authorization") !== `Bearer ${segredo}`) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: "Serviço indisponível." }, { status: 503 });
  const simulada = integracoesSimuladas() ? new URL(request.url).searchParams.get("agora") : null;
  const agora = simulada && Number.isFinite(Date.parse(simulada)) ? new Date(simulada) : new Date();
  const resumo = await avisarContratosSemTaxa(admin, agora);
  return NextResponse.json({ ok: true, agora: agora.toISOString(), ...resumo });
}
