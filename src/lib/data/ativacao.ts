import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { EstadoParceria, FatosConta, Papel } from "@/lib/onboarding/ativacao";
import { ativacoesDe, garantirAtivacoes } from "@/lib/ativacao/servidor";
import type { Prontidao } from "@/lib/anuncio/prontidao";

/**
 * Fatos da conta para os papéis em camadas e o checklist de ativação (Prompt 43), lidos com a sessão da própria pessoa
 * (RLS). Cada contagem falha sozinha para zero — o checklist nunca trava a tela. Recebe a prontidão do rascunho que o
 * Início já leu (getLatestDraft), para não repetir a consulta.
 */
export async function fatosDaConta(rascunho: { prontidao: Prontidao | null } | null): Promise<FatosConta | null> {
  const supabase = await createClient();
  if (!supabase) return null;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const contar = async (q: PromiseLike<{ count: number | null; error: unknown }>) => {
    try {
      const r = await q;
      return r.error ? 0 : (r.count ?? 0);
    } catch {
      return 0;
    }
  };
  const [perfil, favoritos, buscas, candidaturas, pedidos, imoveis, ativos, solicitacao, parceiro] = await Promise.all([
    supabase.from("profiles").select("full_name, avatar_url, role").eq("id", user.id).maybeSingle(),
    contar(supabase.from("favorites").select("id", { count: "exact", head: true }).eq("tenant_id", user.id)),
    contar(supabase.from("buscas_salvas").select("id", { count: "exact", head: true }).eq("usuario_id", user.id)),
    contar(supabase.from("leads").select("id", { count: "exact", head: true }).eq("tenant_id", user.id)),
    contar(supabase.from("pedidos_moradia").select("id", { count: "exact", head: true }).eq("inquilino_id", user.id)),
    contar(supabase.from("properties").select("id", { count: "exact", head: true }).eq("owner_id", user.id)),
    contar(supabase.from("properties").select("id", { count: "exact", head: true }).eq("owner_id", user.id).eq("status", "active")),
    supabase.from("parceiro_solicitacoes").select("status").eq("user_id", user.id).order("criado_em", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("parceiros").select("id, status").eq("user_id", user.id).maybeSingle(),
  ]);
  const p = (perfil.data ?? {}) as { full_name?: string | null; avatar_url?: string | null; role?: string | null };
  const parc = parceiro.data as { id: string; status: string } | null;
  const sol = (solicitacao.data as { status?: string } | null)?.status ?? null;
  let parceria: EstadoParceria = "nenhuma";
  if (parc && parc.status === "publicado") parceria = "publicada";
  else if (parc && parc.status !== "suspenso") parceria = "aprovada";
  else if (sol === "aprovada" || sol === "ativada") parceria = "aprovada";
  else if (sol === "pendente" || sol === "aguardando_email") parceria = "aguardando";
  else if (sol === "recusada") parceria = "recusada";
  const aceitos = parc
    ? await contar(
        supabase.from("parceiro_pedidos").select("id", { count: "exact", head: true }).eq("parceiro_id", parc.id).in("status", ["aceito", "agendado", "em_execucao", "entregue", "concluido"]),
      )
    : 0;
  const ok = (k: string) => !!rascunho?.prontidao?.obrigatorios.find((i) => i.key === k)?.ok;
  return {
    temNome: !!p.full_name?.trim(),
    temFoto: !!p.avatar_url,
    favoritos,
    buscasSalvas: buscas,
    pedidosEnviados: candidaturas + pedidos,
    imoveis,
    imoveisAtivos: ativos,
    rascunhoComDados: ok("endereco"),
    rascunhoComFotos: ok("fotos"),
    rascunhoComValor: ok("preco"),
    parceria,
    pedidosParceiroAceitos: aceitos,
    entrouComoDono: p.role === "owner",
  };
}

/**
 * Prompt 50: as ativações gravadas da pessoa (por papel) e a rede de segurança — o que já aconteceu e ainda não está
 * gravado entra agora, uma vez.
 */
export async function ativacoesDaSessao(fatos: FatosConta): Promise<Partial<Record<Papel, string>>> {
  const supabase = await createClient();
  if (!supabase) return {};
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return {};
  const gravadas = await ativacoesDe(supabase, user.id);
  await garantirAtivacoes(user.id, fatos, gravadas);
  return gravadas;
}
