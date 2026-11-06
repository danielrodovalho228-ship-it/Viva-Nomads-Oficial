"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { consumirLimite, HORA } from "@/lib/limites";
import { COBRANCA_MENSAL_ATIVA } from "@/lib/flags";
import { notify } from "@/lib/notifications";
import { ASSUNTOS } from "@/lib/notifications/assuntos";
import { HREF_ESTADIA } from "@/lib/estadia/estadia";
import { podeConfirmar, podeRegistrar } from "./regras";

/*
  E641 — o livro de pagamentos mensais. ATRÁS DA CHAVE COBRANCA_MENSAL_ATIVA (desligada até o parecer da Dra. Beatriz).
  O MORADOR registra que pagou direto ao dono; o DONO confirma que recebeu. A plataforma não move dinheiro nem decide nada:
  sem registro a parcela fica "não registrado".
*/
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
type Resultado = { ok: true } | { ok: false; error: string };
const erro = (error: string): Resultado => ({ ok: false, error });
const ERRO_DESLIGADA = "Esta função ainda não está disponível.";

async function contexto(parcelaId: string) {
  const supabase = await createClient();
  const admin = createAdminClient();
  if (!supabase || !admin || !UUID_RE.test(parcelaId)) return null;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: p } = await admin.from("cobranca_mensal_parcelas").select("id, contrato_id, estado_livro, valor").eq("id", parcelaId).maybeSingle();
  if (!p) return null;
  const { data: c } = await admin.from("contratos").select("tenant_id, properties(owner_id, title)").eq("id", p.contrato_id as string).maybeSingle();
  if (!c) return null;
  const prop = c.properties as unknown as { owner_id?: string; title?: string } | null;
  return { user, admin, parcela: p as { id: string; contrato_id: string; estado_livro: string | null; valor: number }, tenant_id: c.tenant_id as string, owner_id: prop?.owner_id, imovel: prop?.title ?? "o imóvel" };
}

/** O morador registra que pagou (uma vez). O dono é avisado e a parcela passa a "aguardando confirmação". */
export async function registrarPagamentoMensal(parcelaId: string): Promise<Resultado> {
  if (!COBRANCA_MENSAL_ATIVA) return erro(ERRO_DESLIGADA);
  const ctx = await contexto(parcelaId);
  if (!ctx) return erro("Parcela não encontrada.");
  const { user } = ctx;
  if (ctx.tenant_id !== user.id) return erro("Só o morador registra o próprio pagamento.");
  if (!(await consumirLimite(`cobranca-registra:${user.id}`, 30, HORA))) return erro("Muitas tentativas. Tente de novo em instantes.");
  const pode = podeRegistrar(ctx.parcela.estado_livro);
  if (!pode.ok) return erro(pode.motivo);
  const agora = new Date().toISOString();
  const { error } = await ctx.admin.from("cobranca_mensal_parcelas").update({ estado_livro: "registrado_morador", registrado_em: agora }).eq("id", parcelaId).is("estado_livro", null);
  if (error) return erro("Não foi possível registrar o pagamento.");
  if (ctx.owner_id) {
    const { data: dono } = await ctx.admin.from("profiles").select("email, full_name").eq("id", ctx.owner_id).maybeSingle();
    const d = dono as { email?: string | null; full_name?: string | null } | null;
    if (d?.email) {
      await notify({ event: "contract_status", email: d.email, name: d.full_name ?? undefined, userId: ctx.owner_id, pushUrl: `/dashboard/contratos/${ctx.parcela.contrato_id}`, subject: ASSUNTOS.pagamentoRegistradoMorador, body: (n) => `Olá${n ? " " + n : ""}, o morador registrou o pagamento de uma parcela do aluguel de ${ctx.imovel}. Confirme quando o valor chegar até você.`, ctaLabel: "Ver o contrato" });
      // "Aguardando confirmação" só depois que o dono foi de fato avisado; sem aviso, fica "registrado pelo morador".
      await ctx.admin.from("cobranca_mensal_parcelas").update({ estado_livro: "aguardando_confirmacao" }).eq("id", parcelaId).eq("estado_livro", "registrado_morador");
    }
  }
  revalidatePath(HREF_ESTADIA(ctx.parcela.contrato_id));
  return { ok: true };
}

/** O dono confirma o recebimento do que o morador registrou. A confirmação não se desfaz. */
export async function confirmarPagamentoMensal(parcelaId: string): Promise<Resultado> {
  if (!COBRANCA_MENSAL_ATIVA) return erro(ERRO_DESLIGADA);
  const ctx = await contexto(parcelaId);
  if (!ctx) return erro("Parcela não encontrada.");
  const { user } = ctx;
  if (ctx.owner_id !== user.id) return erro("Só o proprietário confirma o recebimento.");
  if (!(await consumirLimite(`cobranca-confirma:${user.id}`, 60, HORA))) return erro("Muitas tentativas. Tente de novo em instantes.");
  const pode = podeConfirmar(ctx.parcela.estado_livro);
  if (!pode.ok) return erro(pode.motivo);
  const { error } = await ctx.admin.from("cobranca_mensal_parcelas").update({ estado_livro: "confirmado_dono", confirmado_em: new Date().toISOString() }).eq("id", parcelaId).not("estado_livro", "is", null).neq("estado_livro", "confirmado_dono");
  if (error) return erro("Não foi possível confirmar o recebimento.");
  revalidatePath(`/dashboard/contratos/${ctx.parcela.contrato_id}`);
  return { ok: true };
}
