import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { consumirLimite, HORA } from "@/lib/limites";
import { gerarIcs, segredoCalendario, tokenCalendarioValido } from "@/lib/calendario/ical";

/**
 * iCal de exportação do imóvel (ordem 7f905568, parte 1). Link secreto (HMAC do imóvel); o Airbnb/Booking
 * busca de tempos em tempos. Só datas "Ocupado" de contratos ativos — nenhum dado do inquilino.
 */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(request: Request, ctx: { params: Promise<{ id: string; token: string }> }) {
  const { id, token } = await ctx.params;
  const limpo = token.replace(/\.ics$/i, "");
  if (!UUID.test(id) || !tokenCalendarioValido(id, limpo, segredoCalendario())) {
    return new NextResponse("Não encontrado.", { status: 404 });
  }
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "anon";
  if (!(await consumirLimite(`ical:${id}:${ip}`, 120, HORA))) {
    return new NextResponse("Muitas consultas.", { status: 429 });
  }
  const admin = createAdminClient();
  if (!admin) return new NextResponse("Serviço indisponível.", { status: 503 });

  const { data, error } = await admin
    .from("contracts")
    .select("start_date, end_date")
    .eq("property_id", id)
    .eq("status", "active")
    .not("start_date", "is", null)
    .not("end_date", "is", null);
  if (error) return new NextResponse("Serviço indisponível.", { status: 503 });

  const ics = gerarIcs(
    id,
    (data ?? []).map((c) => ({ inicio: String(c.start_date), fim: String(c.end_date) })),
    new Date(),
  );
  return new NextResponse(ics, {
    headers: { "Content-Type": "text/calendar; charset=utf-8", "Cache-Control": "private, max-age=900" },
  });
}
