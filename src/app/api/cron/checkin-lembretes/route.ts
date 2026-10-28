import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { notify } from "@/lib/notifications";
import { hojeEmBrasilia, inicioDaEstadia, lembreteDoDia, textoLembrete, type LembreteCheckin } from "@/lib/checkin";
import { primeiroPagamentoConfirmado, type LinhaEstadoContrato } from "@/lib/contrato-estado";
import { corpoDaChegada, lembreteDeChegadaPermitido } from "@/lib/estadia/emails-chegada";
import { instrucoesEfetivas, normalizarInstrucoes } from "@/lib/estadia/instrucoes";

/**
 * Check-in garantido (ordem 404cd213, item 2): lembrete da entrada ao proprietário e ao inquilino quando faltam
 * 2 dias (48 h) e 1 dia (24 h). Cron diário da Vercel (vercel.json) com `Authorization: Bearer <CRON_SECRET>`;
 * sem o segredo, não roda. Só contratos ativos assinados pelas duas partes. Cada lembrete sai UMA vez por contrato
 * (marcado em contratos_checkin). Sem telefone de plantão no e-mail.
 * E209: só com o contrato assinado pelas duas partes E o 1º pagamento confirmado (a mesma condição que libera as
 * instruções no D-7); o corpo (HTML) traz o imóvel, as datas da estadia e, para o morador, as instruções de chegada.
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
      .select("id, property_id, tenant_id, status, assinado_proprietario_em, assinado_inquilino_em, properties(owner_id, title, address, city, checkin_after, checkout_before), contrato_blocos(inicio, fim, status), pagamentos_bloco(tipo, confirmado_pelo_inquilino, anulado_em)")
      .in("id", ids)
      .eq("status", "ativo")
      .not("assinado_proprietario_em", "is", null)
      .not("assinado_inquilino_em", "is", null);
    for (const c of contratos ?? []) {
      const blocos = ((c.contrato_blocos as { inicio: string; fim: string; status: string | null }[] | null) ?? []).filter((b) => b.status !== "nao_aceito");
      const inicio = inicioDaEstadia(blocos);
      const lembrete: LembreteCheckin | null = inicio ? lembreteDoDia(inicio, hoje) : null;
      if (!inicio || !lembrete) continue;
      // E209: chegada só com contrato assinado + 1º pagamento feito (o lembrete segue a mesma condição do D-7).
      const pago = primeiroPagamentoConfirmado(c.pagamentos_bloco as LinhaEstadoContrato["pagamentos_bloco"]);
      if (!lembreteDeChegadaPermitido({ assinadoPelasDuas: !!c.assinado_proprietario_em && !!c.assinado_inquilino_em, primeiroPagamento: pago })) continue;
      const coluna = lembrete === "48h" ? "lembrete_48h_em" : "lembrete_24h_em";
      const { data: k } = await admin.from("contratos_checkin").select(`horario, instrucoes, ${coluna}`).eq("contrato_id", c.id).maybeSingle();
      const linha = k as unknown as Record<string, string | null> | null;
      if (linha?.[coluna]) continue;
      // Marca ANTES de enviar: se o envio falhar, melhor perder um lembrete do que mandar duas vezes.
      const { error } = await admin.from("contratos_checkin").upsert({ contrato_id: c.id, [coluna]: new Date().toISOString() }, { onConflict: "contrato_id" });
      if (error) continue;
      const prop = c.properties as unknown as { owner_id?: string; title?: string | null; address?: string | null; city?: string | null; checkin_after?: string | null; checkout_before?: string | null } | null;
      const donoId = prop?.owner_id;
      const texto = textoLembrete(lembrete, inicio, linha?.horario ?? null);
      const { data: im } = await admin.from("imovel_instrucoes_chegada").select("*").eq("property_id", c.property_id as string).maybeSingle();
      const instrucoes = instrucoesEfetivas(im ? normalizarInstrucoes(im as Record<string, unknown>) : null, linha?.instrucoes);
      const estadia = {
        imovel: { titulo: prop?.title, bairro: prop?.address, cidade: prop?.city },
        entrada: inicio,
        saida: blocos.map((b) => b.fim).sort().at(-1) ?? null,
        horarioEntrada: linha?.horario || prop?.checkin_after,
        horarioSaida: prop?.checkout_before,
      };
      for (const uid of [donoId, c.tenant_id as string]) {
        if (!uid) continue;
        const corpo = corpoDaChegada(estadia, instrucoes, uid === c.tenant_id, texto);
        const { data: p } = await admin.from("profiles").select("email, full_name, notif_email").eq("id", uid).maybeSingle();
        await notify({
          event: "checkin_lembrete",
          email: p?.email && p.notif_email !== false ? (p.email as string) : undefined,
          name: (p?.full_name as string) ?? undefined,
          userId: uid,
          pushUrl: `/dashboard/contratos/${c.id}`,
          detailsText: corpo.texto,
          detailsHtml: corpo.html,
        }).catch(() => null);
        enviados++;
      }
    }
  }
  return NextResponse.json({ ok: true, enviados });
}
