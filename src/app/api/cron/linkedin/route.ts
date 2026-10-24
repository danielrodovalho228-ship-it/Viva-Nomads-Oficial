import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { integracoesSimuladas } from "@/lib/integracoes";
import { avisar } from "@/lib/vistoria/servidor";
import { rotinaLinkedin } from "@/lib/linkedin/servidor";

/**
 * 63-B — 1×/dia: "Reconecte seu LinkedIn para manter o selo" 30 dias antes de vencer (uma vez por conexão). O selo
 * vencido some sozinho (a leitura confere valido_ate). Exige `Authorization: Bearer <CRON_SECRET>`.
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
  const r = await rotinaLinkedin(admin, agora, (uid) => avisar(admin, uid, "linkedin_vencendo", "/dashboard/conta/privacidade"));
  return NextResponse.json({ ok: true, agora: agora.toISOString(), ...r });
}
