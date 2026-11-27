"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { fatosDaConta } from "@/lib/data/ativacao";
import { papeisDaConta } from "@/lib/onboarding/ativacao";
import { ehParceiroAprovado } from "@/lib/parceiros/painel-actions";
import { contaNoPrimeiroAcesso, gravacaoPorArea, modoDoPapel, papelGravadoEfetivo, papelValido, type Papel } from "@/lib/papel/papel-ativo";

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
  // E668: "parceiro" só vale se foi escolhido (carimbo). Leitura à parte e tolerante à migração ainda não aplicada.
  let escolhidoEm: unknown = g === "parceiro" ? "?" : null;
  if (g === "parceiro") {
    const esc = await supabase.from("profiles").select("papel_ativo_escolhido_em").eq("id", user.id).maybeSingle();
    if (!esc.error) escolhidoEm = (esc.data as { papel_ativo_escolhido_em?: unknown } | null)?.papel_ativo_escolhido_em ?? null;
  }
  return { papeis, gravado: papelGravadoEfetivo(g, escolhidoEm) };
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
    // E653: abrir uma página de área NUNCA grava o papel (parceiro incluído) — só o 1º acesso grava o modo (E283).
    // Estados vazios: sem a leitura, a conta passaria por "1º acesso" (só o modo, e ok sem trocar o papel). Nada grava.
    const { data: atual, error: erroAtual } = await supabase.from("profiles").select("intencao, papel_ativo").eq("id", user.id).maybeSingle();
    if (erroAtual) return { ok: false, erro: "Não foi possível trocar agora." };
    const a = atual as { intencao?: unknown; papel_ativo?: unknown } | null;
    if (gravacaoPorArea(papel, contaNoPrimeiroAcesso(a?.intencao, a?.papel_ativo)) === "nada" || !modo) return { ok: true };
    const { error } = await supabase.from("profiles").update({ preferred_mode: modo }).eq("id", user.id);
    return error ? { ok: false, erro: "Não foi possível trocar agora." } : { ok: true };
  }
  // E668: escolher o papel pelo selo/Conta carimba a escolha (é o que faz o "parceiro" valer no próximo login).
  const base = modo ? { papel_ativo: papel, preferred_mode: modo } : { papel_ativo: papel };
  let { error } = await supabase.from("profiles").update({ ...base, papel_ativo_escolhido_em: new Date().toISOString() }).eq("id", user.id);
  // Migração 0318 ainda não aplicada (coluna inexistente, 42703): grava como antes e tenta o carimbo depois.
  if (error && (error.code === "42703" || /papel_ativo_escolhido_em/.test(error.message ?? ""))) {
    ({ error } = await supabase.from("profiles").update(base).eq("id", user.id));
  }
  if (error) return { ok: false, erro: "Não foi possível trocar agora." };
  revalidatePath("/dashboard/conta");
  return { ok: true };
}
