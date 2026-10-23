import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import type { FatosConta, Papel } from "@/lib/onboarding/ativacao";
import { ativacoesParaGravar } from "./regras";

/*
  Prompt 50 — grava a ATIVAÇÃO de um papel no momento do fato (1º pedido enviado, 1º anúncio publicado, 1º pedido
  aceito). Uma linha por pessoa e papel (chave primária): repetir não muda a data. Nunca lança — a ação principal já
  aconteceu; o Início também confere e grava o que faltar (rede de segurança).
*/

type Admin = SupabaseClient;

export async function registrarAtivacao(userId: string | null | undefined, papel: Papel, agora = new Date(), admin: Admin | null = createAdminClient()): Promise<void> {
  if (!userId || !admin) return;
  try {
    await admin.from("ativacoes").upsert({ user_id: userId, papel, ativado_em: agora.toISOString() }, { onConflict: "user_id,papel", ignoreDuplicates: true });
  } catch {
    /* complemento: nunca derruba a ação */
  }
}

/** As ativações gravadas da pessoa (sem a 0217: nenhuma — o checklist decide pelo fato). */
export async function ativacoesDe(db: SupabaseClient, userId: string): Promise<Partial<Record<Papel, string>>> {
  try {
    const { data } = await db.from("ativacoes").select("papel, ativado_em").eq("user_id", userId);
    return Object.fromEntries(((data ?? []) as { papel: Papel; ativado_em: string }[]).map((a) => [a.papel, a.ativado_em]));
  } catch {
    return {};
  }
}

/** Rede de segurança do Início: grava o que já aconteceu e ainda não está em ativacoes. */
export async function garantirAtivacoes(userId: string, fatos: FatosConta, gravadas: Partial<Record<Papel, string>>, agora = new Date()): Promise<void> {
  for (const papel of ativacoesParaGravar(fatos, gravadas, agora)) await registrarAtivacao(userId, papel, agora);
}
