import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { notify } from "@/lib/notifications";
import { hojeEmBrasilia, inicioDaEstadia, lembreteDoDia, textoLembrete, type LembreteCheckin } from "@/lib/checkin";

/**
 * Check-in garantido (ordem 404cd213, item 2): lembrete da entrada ao proprietário e ao inquilino quando faltam
 * 2 dias (48 h) e 1 dia (24 h). Cron diário da Vercel (vercel.json) com `Authorization: Bearer <CRON_SECRET>`;
 * sem o segredo, não roda. Só contratos ativos assinados pelas duas partes. Cada lembrete sai UMA vez por contrato
 * (marcado em contratos_checkin). Sem telefone de plantão nem instrução no e-mail: só o dia e o horário.
 */
export async function GET(request: Request) {
  const segredo = process.env.CRON_SECRET;
  if (!segredo) return NextResponse.json({ error: "CRON_SECRET não configurado." }, { status: 503 });
  if (request.headers.get("authorization") !== `Bearer ${segredo}`) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }
  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: "Serviço indisponível." }, { status: 503 });

  const hoje = hojeEmBrasilia(new Date());
  const dia = (n: number) => new Date(Date.parse(hoje) + n * 86_400_000).toISOString().slice(0, 10);
  const { data: blocos } = await admin.from("contrato_blocos").select("contrato_id").gte("inicio", dia(1)).lte("inicio", dia(2)).limit(500);
  const ids = [...new Set((blocos ?? []).map((b) => b.contrato_id as string))];
  let enviados = 0;
  if (ids.length) {
    const { data: contratos } = await admin
      .from("contratos")
      .select("id, tenant_id, status, assinado_proprietario_em, assinado_inquilino_em, properties(owner_id), contrato_blocos(inicio)")
      .in("id", ids)
      .eq("status", "ativo")
      .not("assinado_proprietario_em", "is", null)
      .not("assinado_inquilino_em", "is", null);
    for (const c of contratos ?? []) {
      const inicio = inicioDaEstadia((c.contrato_blocos as { inicio: string }[] | null) ?? []);
      const lembrete: LembreteCheckin | null = inicio ? lembreteDoDia(inicio, hoje) : null;
      if (!inicio || !lembrete) continue;
      const coluna = lembrete === "48h" ? "lembrete_48h_em" : "lembrete_24h_em";
      const { data: k } = await admin.from("contratos_checkin").select(`horario, ${coluna}`).eq("contrato_id", c.id).maybeSingle();
      const linha = k as unknown as Record<string, string | null> | null;
      if (linha?.[coluna]) continue;
      // Marca ANTES de enviar: se o envio falhar, melhor perder um lembrete do que mandar duas vezes.
      const { error } = await admin.from("contratos_checkin").upsert({ contrato_id: c.id, [coluna]: new Date().toISOString() }, { onConflict: "contrato_id" });
      if (error) continue;
      const donoId = (c.properties as unknown as { owner_id?: string } | null)?.owner_id;
      const texto = textoLembrete(lembrete, inicio, linha?.horario ?? null);
      for (const uid of [donoId, c.tenant_id as string]) {
        if (!uid) continue;
        const { data: p } = await admin.from("profiles").select("email, full_name, notif_email").eq("id", uid).maybeSingle();
        await notify({
          event: "checkin_lembrete",
          email: p?.email && p.notif_email !== false ? (p.email as string) : undefined,
          name: (p?.full_name as string) ?? undefined,
          userId: uid,
          pushUrl: `/dashboard/contratos/${c.id}`,
          detailsText: texto,
        }).catch(() => null);
        enviados++;
      }
    }
  }
  return NextResponse.json({ ok: true, enviados });
}
