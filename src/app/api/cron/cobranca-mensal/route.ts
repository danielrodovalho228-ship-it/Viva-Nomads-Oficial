import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { integracoesSimuladas } from "@/lib/integracoes";
import { COBRANCA_MENSAL_ATIVA } from "@/lib/flags";
import { rodarCobrancaMensal } from "@/lib/cobranca-mensal/servidor";

/**
 * E641 — cobrança mensal dos contratos longos (1×/dia pela Vercel): cria o cronograma e manda os lembretes neutros D-5/D-3.
 * Exige `Authorization: Bearer <CRON_SECRET>`. ATRÁS DA CHAVE COBRANCA_MENSAL_ATIVA (desligada): sem ela, responde ok e não faz nada.
 * Só no laboratório (INTEGRACOES_SIMULADAS=on): `?agora=<ISO>`.
 */
export async function GET(request: Request) {
  const segredo = process.env.CRON_SECRET;
  if (!segredo) return NextResponse.json({ error: "CRON_SECRET não configurado." }, { status: 503 });
  if (request.headers.get("authorization") !== `Bearer ${segredo}`) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  if (!COBRANCA_MENSAL_ATIVA) return NextResponse.json({ ok: true, ativa: false });
  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: "Serviço indisponível." }, { status: 503 });
  const simulada = integracoesSimuladas() ? new URL(request.url).searchParams.get("agora") : null;
  const agora = simulada && Number.isFinite(Date.parse(simulada)) ? new Date(simulada) : new Date();
  const resumo = await rodarCobrancaMensal(admin, agora);
  return NextResponse.json({ ok: true, agora: agora.toISOString(), ...resumo });
}
