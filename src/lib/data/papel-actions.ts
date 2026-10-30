"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { fatosDaConta } from "@/lib/data/ativacao";
import { papeisDaConta } from "@/lib/onboarding/ativacao";
import { ehParceiroAprovado } from "@/lib/parceiros/painel-actions";
import { contaNoPrimeiroAcesso, modoDoPapel, papelValido, type Papel } from "@/lib/papel/papel-ativo";

/**
 * PAPEL-B — papel ativo gravado no perfil (profiles.papel_ativo, 0222). Só muda o menu e o painel que aparecem primeiro;
 * nunca permissão. Morador e proprietário também gravam o modo (preferred_mode), que o proxy e as rotas de IA ainda leem.
 */

/** Os papéis que a conta TEM (o menu de troca só mostra estes) e o papel gravado (null = derivar do modo). */
export async function estadoDosPapeis(): Promise<{ papeis: Papel[]; gravado: Papel | null } | null> {
  const supabase = await createClient();
  if (!supabase) return null;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const [fatos, parceiro, perfil] = await Promise.all([
    fatosDaConta(null).catch(() => null),
    ehParceiroAprovado().catch(() => false),
    supabase.from("profiles").select("papel_ativo").eq("id", user.id).maybeSingle(),
  ]);
  const dono = !!fatos && papeisDaConta(fatos).some((p) => p.papel === "proprietario" && p.ativo);
  const papeis: Papel[] = ["morador", ...(dono ? (["proprietario"] as const) : []), ...(parceiro ? (["parceiro"] as const) : [])];
  const g = (perfil.data as { papel_ativo?: unknown } | null)?.papel_ativo;
  return { papeis, gravado: papelValido(g) ? g : null };
}

/**
 * Usa a conta como `papel`: grava o papel ativo (e o modo, para morador e proprietário). Parceiro só com a parceria
 * aprovada. Proprietário vale para quem ainda não anunciou (o convite "Anunciar um imóvel" leva às telas de dono).
 * `origem: "area"` = a troca automática de quem só ABRIU uma página de outra área (SincronizarPapel).
 */
export async function usarPapel(papel: unknown, origem?: "area"): Promise<{ ok: true } | { ok: false; erro: string }> {
  if (!papelValido(papel)) return { ok: false, erro: "Papel inválido." };
  const supabase = await createClient();
  if (!supabase) return { ok: true }; // demo/preview: sem servidor, sem escrita
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, erro: "Sessão expirada. Entre de novo." };
  if (papel === "parceiro" && !(await ehParceiroAprovado().catch(() => false))) return { ok: false, erro: "A parceria ainda não foi aprovada." };
  const modo = modoDoPapel(papel);
  // E283/L-78: conta no PRIMEIRO acesso (intenção e papel ativo ainda vazios) que só abriu uma página de outra área
  // grava o modo (o proxy e a IA das fotos o leem), mas NÃO o papel ativo: quem decide o papel inicial — e manda as
  // boas-vindas — é a intenção (a tela, ou o 1º rascunho de anúncio). Antes, abrir "Anunciar" gastava o 1º acesso e o
  // morador que virava dono pelo rascunho ficava sem as boas-vindas de dono.
  if (origem === "area") {
    const { data: atual } = await supabase.from("profiles").select("intencao, papel_ativo").eq("id", user.id).maybeSingle();
    const a = atual as { intencao?: unknown; papel_ativo?: unknown } | null;
    if (contaNoPrimeiroAcesso(a?.intencao, a?.papel_ativo)) {
      if (!modo) return { ok: true };
      const { error } = await supabase.from("profiles").update({ preferred_mode: modo }).eq("id", user.id);
      return error ? { ok: false, erro: "Não foi possível trocar agora." } : { ok: true };
    }
  }
  const { error } = await supabase
    .from("profiles")
    .update(modo ? { papel_ativo: papel, preferred_mode: modo } : { papel_ativo: papel })
    .eq("id", user.id);
  if (error) return { ok: false, erro: "Não foi possível trocar agora." };
  revalidatePath("/dashboard/conta");
  return { ok: true };
}
