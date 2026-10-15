"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { consumirLimite, HORA } from "@/lib/limites";
import { inquilinoVeInstrucoes, podeEditarInstrucoes, validarInstrucoes, type InstrucoesEntrada } from "@/lib/checkin";

/*
  Check-in garantido (ordem 404cd213, item 2). Leitura e escrita pelo servidor, DEPOIS de conferir
  quem é a pessoa no contrato. O telefone de plantão e as instruções nunca vão para log nem URL.
*/

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface InstrucoesDoContrato {
  papel: "inquilino" | "proprietario";
  /** null = ainda não preenchidas, ou o inquilino ainda não pode ver (falta assinatura). */
  dados: InstrucoesEntrada | null;
  preenchidas: boolean;
  atualizadoEm: string | null;
}

async function contexto(contratoId: string) {
  if (!UUID_RE.test(contratoId ?? "")) return null;
  const supabase = await createClient();
  const admin = createAdminClient();
  if (!supabase || !admin) return null;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: c } = await admin
    .from("contratos")
    .select("tenant_id, status, assinado_proprietario_em, assinado_inquilino_em, checkin_horario, checkin_instrucoes, checkin_plantao, checkin_atualizado_em, properties(owner_id)")
    .eq("id", contratoId)
    .maybeSingle();
  if (!c) return null;
  const donoId = (c.properties as unknown as { owner_id?: string } | null)?.owner_id;
  const papel = c.tenant_id === user.id ? ("inquilino" as const) : donoId === user.id ? ("proprietario" as const) : null;
  if (!papel) return null;
  return { admin, uid: user.id, c, papel };
}

/** Instruções de entrada: o proprietário vê sempre; o inquilino só com as duas assinaturas. */
export async function instrucoesDoContrato(contratoId: string): Promise<InstrucoesDoContrato | null> {
  const ctx = await contexto(contratoId);
  if (!ctx) return null;
  const { c, papel } = ctx;
  const preenchidas = !!(c.checkin_horario && c.checkin_instrucoes && c.checkin_plantao);
  const pode = papel === "proprietario" || inquilinoVeInstrucoes({ status: String(c.status), papel, assinadoProprietarioEm: c.assinado_proprietario_em, assinadoInquilinoEm: c.assinado_inquilino_em });
  const dados = pode && preenchidas ? { horario: c.checkin_horario as string, instrucoes: c.checkin_instrucoes as string, plantao: c.checkin_plantao as string } : null;
  return { papel, dados, preenchidas, atualizadoEm: (c.checkin_atualizado_em as string | null) ?? null };
}

/** O proprietário grava horário, como entrar e telefone de plantão. */
export async function salvarInstrucoesEntrada(input: { contratoId: string; horario: string; instrucoes: string; plantao: string }): Promise<{ ok: true } | { ok: false; error: string }> {
  const ctx = await contexto(input?.contratoId);
  if (!ctx) return { ok: false, error: "Você não faz parte deste contrato." };
  const { admin, uid, c, papel } = ctx;
  if (!podeEditarInstrucoes({ status: String(c.status), papel })) return { ok: false, error: "Só o proprietário edita as instruções, com o contrato ativo." };
  const v = validarInstrucoes(input);
  if (!v.ok) return { ok: false, error: v.erro };
  if (!(await consumirLimite(`checkin-instrucoes:${uid}`, 30, HORA))) return { ok: false, error: "Muitas alterações em pouco tempo. Tente de novo em instantes." };
  const { error } = await admin
    .from("contratos")
    .update({ checkin_horario: v.dados.horario, checkin_instrucoes: v.dados.instrucoes, checkin_plantao: v.dados.plantao, checkin_atualizado_em: new Date().toISOString() })
    .eq("id", input.contratoId);
  if (error) {
    console.error("[checkin] salvar:", error.code);
    return { ok: false, error: "Não foi possível salvar agora. Tente de novo." };
  }
  revalidatePath("/dashboard/contratos");
  revalidatePath("/dashboard/locacoes");
  return { ok: true };
}
