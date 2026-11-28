import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { integracoesSimuladas } from "@/lib/integracoes";
import { rodarDevolucaoCaucao } from "@/lib/caucao/devolucao-servidor";

/**
 * E1248 PR 1 — a máquina da devolução da caução, de hora a hora (ESPEC-E1248 v11, 2.3; ORDENS 1322 e 1325): a
 * confirmação por falta de resposta (com a hora do fim do prazo), o lembrete das últimas 24 horas ao morador e o
 * lembrete do anexo ao dono. Exige `Authorization: Bearer <CRON_SECRET>`. SEM CHAVE (decisão 2): o silêncio vale desde
 * o primeiro dia. Só no laboratório (INTEGRACOES_SIMULADAS=on): `?agora=<ISO>`.
 */
export async function GET(request: Request) {
  const segredo = process.env.CRON_SECRET;
  if (!segredo) return NextResponse.json({ error: "CRON_SECRET não configurado." }, { status: 503 });
  if (request.headers.get("authorization") !== `Bearer ${segredo}`) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: "Serviço indisponível." }, { status: 503 });
  const simulada = integracoesSimuladas() ? new URL(request.url).searchParams.get("agora") : null;
  const agora = simulada && Number.isFinite(Date.parse(simulada)) ? new Date(simulada) : new Date();
  const resumo = await rodarDevolucaoCaucao(admin, agora);
  return NextResponse.json({ ok: true, agora: agora.toISOString(), ...resumo });
}
