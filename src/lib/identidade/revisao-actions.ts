"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sessaoAal2 } from "@/lib/data/admin-guard";
import { validadeDoLaudo } from "@/lib/caf/validade";
import { notify } from "@/lib/notifications";
import { recusaObservador } from "@/lib/qa/observador";

/*
  Prompt 50 (item 4) — a análise de uma pessoa da equipe depois da 2ª reprovação automática da verificação. Só admin
  com duas etapas. Aprovada: grava o laudo da revisão humana (vale 12 meses, como o automático). Recusada: o motivo
  escrito vai para a pessoa, com o próximo passo.
*/

export type Res = { ok: true; mensagem?: string } | { ok: false; erro: string };

export async function adminDecidirVerificacao(form: FormData): Promise<Res> {
  const supabase = await createClient();
  const admin = createAdminClient();
  if (!supabase || !admin) return { ok: false, erro: "Serviço indisponível." };
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, erro: "Esta ação não está disponível." };
  const { data: perfil } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (!(perfil?.role === "admin" && (await sessaoAal2(supabase)))) return { ok: false, erro: "Esta ação não está disponível." };
  const { data: revQa } = await admin.from("verificacao_revisoes").select("user_id").eq("id", String(form.get("id") ?? "")).maybeSingle();
  const recusaQa = await recusaObservador(user.id, { perfis: [(revQa?.user_id as string | null) ?? null], semPerfil: revQa?.user_id ? 0 : 1 });
  if (recusaQa) return { ok: false, erro: recusaQa };

  const resultado = String(form.get("resultado") ?? "");
  const observacao = String(form.get("observacao") ?? "").replace(/\s+/g, " ").trim().slice(0, 500) || null;
  if (resultado !== "aprovada" && resultado !== "recusada") return { ok: false, erro: "Escolha aprovar ou recusar." };
  if (resultado === "recusada" && (!observacao || observacao.length < 10)) return { ok: false, erro: "Escreva o motivo e o próximo passo para a pessoa." };
  const agora = new Date();
  const { data: r } = await admin
    .from("verificacao_revisoes")
    .update({ resultado, observacao, decidido_em: agora.toISOString(), decidido_por: user.id })
    .eq("id", String(form.get("id") ?? ""))
    .is("decidido_em", null)
    .select("user_id")
    .maybeSingle();
  if (!r) return { ok: false, erro: "Esta análise já foi decidida." };
  if (resultado === "aprovada") {
    await admin.from("tenant_verifications").insert({
      tenant_id: r.user_id,
      caf_result: { light: "green", identity: true, liveness: true, document: true, coversForeigners: true, notes: ["Aprovada pela equipe após análise de uma pessoa."], revisaoHumana: true },
      traffic_light: "green",
      valid_until: validadeDoLaudo(agora).toISOString(),
    });
  }
  const { data: p } = await admin.from("profiles").select("email, full_name, notif_email").eq("id", r.user_id).maybeSingle();
  const d = p as { email: string | null; full_name: string | null; notif_email: boolean | null } | null;
  await notify({
    event: "verificacao_parada",
    email: d?.notif_email === false ? undefined : (d?.email ?? undefined),
    name: d?.full_name ?? undefined,
    userId: r.user_id as string,
    pushUrl: "/dashboard/verificacao",
    subject: resultado === "aprovada" ? "Sua identidade foi confirmada pela equipe" : "A equipe analisou sua verificação de identidade",
    body: (n) => (resultado === "aprovada" ? `Olá${n ? " " + n : ""}, uma pessoa da equipe analisou sua verificação e confirmou sua identidade.` : `Olá${n ? " " + n : ""}, uma pessoa da equipe analisou sua verificação. Veja abaixo o que falta e o próximo passo.`),
    detailsText: observacao ?? undefined,
  }).catch(() => null);
  revalidatePath("/admin/documentos");
  return { ok: true, mensagem: resultado === "aprovada" ? "Identidade confirmada." : "Recusa enviada com o próximo passo." };
}
