import { NextResponse } from "next/server";
import { enviarResumosDiarios } from "@/lib/data/pedidos-compat";
import { enviarResumosAlertaBusca } from "@/lib/data/alerta-busca-servidor";

/**
 * Resumo diário dos pedidos compatíveis que passaram do limite de 5 e-mails
 * por dono por dia. Disparado pelo Cron da Vercel (vercel.json, 08:00 de
 * Brasília) com `Authorization: Bearer <CRON_SECRET>`. Sem o segredo
 * configurado, não roda (nunca fica aberto).
 */
export async function GET(request: Request) {
  const segredo = process.env.CRON_SECRET;
  if (!segredo) return NextResponse.json({ error: "CRON_SECRET não configurado." }, { status: 503 });
  if (request.headers.get("authorization") !== `Bearer ${segredo}`) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }
  const r = await enviarResumosDiarios();
  // Mesmo disparo diário: resumo dos alertas de busca salva que passaram do limite de 1/dia (ordem cb9a09e9).
  const alertas = await enviarResumosAlertaBusca().catch(() => ({ buscas: 0, enviados: 0 }));
  return NextResponse.json({ ok: true, ...r, alertasBusca: alertas });
}
