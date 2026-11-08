import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { integracoesSimuladas } from "@/lib/integracoes";
import { PRE_ACEITACAO_72H_ATIVA } from "@/lib/flags";
import { rodarPreAceitacao } from "@/lib/propostas/pre-aceitacao-servidor";

/**
 * E722 — pré-aceitação de 72 h: lembretes de 24 h e 6 h e expiração sem punição. Exige `Authorization: Bearer <CRON_SECRET>`.
 * ATRÁS DA CHAVE PRE_ACEITACAO_72H_ATIVA (desligada): sem ela, responde ok e não faz nada. Roda de hora em hora
 * (vercel.json: "0 * * * *"), porque os lembretes são de 24 h e 6 h antes do fim. Só no laboratório
 * (INTEGRACOES_SIMULADAS=on): `?agora=<ISO>`.
 */
export async function GET(request: Request) {
  const segredo = process.env.CRON_SECRET;
  if (!segredo) return NextResponse.json({ error: "CRON_SECRET não configurado." }, { status: 503 });
  if (request.headers.get("authorization") !== `Bearer ${segredo}`) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  if (!PRE_ACEITACAO_72H_ATIVA) return NextResponse.json({ ok: true, ativa: false });
  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: "Serviço indisponível." }, { status: 503 });
  const simulada = integracoesSimuladas() ? new URL(request.url).searchParams.get("agora") : null;
  const agora = simulada && Number.isFinite(Date.parse(simulada)) ? new Date(simulada) : new Date();
  const resumo = await rodarPreAceitacao(admin, agora);
  return NextResponse.json({ ok: true, agora: agora.toISOString(), ...resumo });
}
