import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { notify } from "@/lib/notifications";
import { COBRANCA_MENSAL_ATIVA } from "@/lib/flags";
import { ASSUNTOS } from "@/lib/notifications/assuntos";
import { HREF_ESTADIA } from "@/lib/estadia/estadia";
import { MIN_DIAS_COBRANCA_MENSAL, TETO_DIAS_ACUMULADOS, cronogramaMensal, lembreteDaParcela, textoDoLembrete } from "./regras";

/*
  E641 — roda a cobrança mensal (1×/dia). ATRÁS DA CHAVE COBRANCA_MENSAL_ATIVA (desligada): sem ela, não faz nada.
    • contrato ativo de 91 a 180 dias ganha o cronograma (uma linha por parcela);
    • parcela ainda sem registro recebe UM lembrete neutro no D-5 e outro no D-3, antes do vencimento.
  A plataforma não cobra, não acompanha pagamento e não age depois do vencimento: aqui só se calcula e se lembra.
*/
export interface ResumoCobrancaMensal {
  ativa: boolean;
  contratos: number;
  parcelasCriadas: number;
  lembretes: number;
}

const dia = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(d);

/** Cria (uma vez) as parcelas de um contrato. Devolve quantas linhas novas entraram. */
export async function gerarParcelasDoContrato(admin: SupabaseClient, contratoId: string): Promise<number> {
  if (!COBRANCA_MENSAL_ATIVA) return 0;
  const { data: c } = await admin
    .from("contratos")
    .select("id, status, aluguel_mensal, comissao_percent, contrato_blocos(inicio, fim, status)")
    .eq("id", contratoId)
    .maybeSingle();
  if (!c || c.status !== "ativo") return 0;
  const blocos = ((c.contrato_blocos ?? []) as { inicio: string; fim: string; status: string | null }[]).filter((b) => b.status !== "nao_aceito");
  const inicios = blocos.map((b) => b.inicio).sort();
  const fins = blocos.map((b) => b.fim).sort();
  if (!inicios.length) return 0;
  const cron = cronogramaMensal({ checkin: inicios[0], checkout: fins[fins.length - 1], aluguelMensal: Number(c.aluguel_mensal), taxa: Number(c.comissao_percent ?? 0) });
  if (!cron.ok) return 0;
  const { data } = await admin
    .from("cobranca_mensal_parcelas")
    .upsert(
      cron.parcelas.map((p) => ({ contrato_id: contratoId, numero: p.numero, vence_em: p.venceEm, tipo: p.tipo, dias: p.dias, adiantada: p.adiantada, valor: p.valor, taxa_viva: p.taxaViva })),
      { onConflict: "contrato_id,numero", ignoreDuplicates: true },
    )
    .select("id");
  return data?.length ?? 0;
}

export async function rodarCobrancaMensal(admin: SupabaseClient, agora: Date = new Date()): Promise<ResumoCobrancaMensal> {
  if (!COBRANCA_MENSAL_ATIVA) return { ativa: false, contratos: 0, parcelasCriadas: 0, lembretes: 0 };
  const hoje = dia(agora);
  const resumo: ResumoCobrancaMensal = { ativa: true, contratos: 0, parcelasCriadas: 0, lembretes: 0 };

  const { data: contratos } = await admin
    .from("contratos")
    .select("id")
    .eq("status", "ativo")
    .gte("prazo_total_dias", MIN_DIAS_COBRANCA_MENSAL)
    .lte("prazo_total_dias", TETO_DIAS_ACUMULADOS);
  for (const c of (contratos ?? []) as { id: string }[]) {
    resumo.contratos++;
    resumo.parcelasCriadas += await gerarParcelasDoContrato(admin, c.id);
  }

  const { data: parcelas } = await admin
    .from("cobranca_mensal_parcelas")
    .select("id, contrato_id, vence_em, valor, estado_livro, lembrou_d5_em, lembrou_d3_em")
    .is("estado_livro", null)
    .gte("vence_em", hoje);
  for (const p of (parcelas ?? []) as { id: string; contrato_id: string; vence_em: string; valor: number; estado_livro: string | null; lembrou_d5_em: string | null; lembrou_d3_em: string | null }[]) {
    const l = lembreteDaParcela({ venceEm: p.vence_em, hoje, estado: p.estado_livro });
    if (!l || (l === "D-5" && p.lembrou_d5_em) || (l === "D-3" && p.lembrou_d3_em)) continue;
    const { data: ctr } = await admin.from("contratos").select("tenant_id").eq("id", p.contrato_id).maybeSingle();
    const { data: perfil } = ctr?.tenant_id ? await admin.from("profiles").select("email, full_name").eq("id", ctr.tenant_id as string).maybeSingle() : { data: null };
    const morador = perfil as { email?: string | null; full_name?: string | null } | null;
    if (!morador?.email) continue;
    // Marca ANTES de avisar: uma falha no envio nunca vira lembrete repetido.
    const { error } = await admin.from("cobranca_mensal_parcelas").update(l === "D-5" ? { lembrou_d5_em: agora.toISOString() } : { lembrou_d3_em: agora.toISOString() }).eq("id", p.id);
    if (error) continue;
    const texto = textoDoLembrete(l, { valor: Number(p.valor), venceEm: p.vence_em });
    await notify({ event: "contract_status", email: morador.email, name: morador.full_name ?? undefined, userId: ctr?.tenant_id as string, pushUrl: HREF_ESTADIA(p.contrato_id), subject: ASSUNTOS.lembreteParcelaAluguel, body: (n) => `Olá${n ? " " + n : ""}, ${texto.charAt(0).toLowerCase()}${texto.slice(1)}`, ctaLabel: "Ver a estadia" });
    resumo.lembretes++;
  }
  return resumo;
}
