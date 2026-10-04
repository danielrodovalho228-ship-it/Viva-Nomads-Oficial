import { NextResponse } from "next/server";
import { enviarResumosDiarios } from "@/lib/data/pedidos-compat";

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
  return NextResponse.json({ ok: true, ...r });
}
