/*
  E1079 (ORDEM-DUET-385, tela 4 — mockup morador-servico-avaliador): o cartão "Avaliação do imóvel — Laudo com o nível
  do imóvel" na grade de Serviços. Quem pede a avaliação é o DONO, na página Nível de cada imóvel. A avaliação NÃO vira
  categoria contratável do catálogo (segue só de credenciamento).
  E1104 (ORDEM-DUET-470): o cartão é a PORTA de descoberta, de todo dono — já não depende de a avaliação estar aberta
  para a conta. Sem avaliação em curso, leva à porta (/dashboard/servicos/avaliacao: escolher o imóvel e começar o
  pedido); com avaliação em curso, leva ao pedido. Fora do piloto, a porta diz o estado honesto e NADA da avaliação é
  lido (o piloto continua fechado: nenhum pedido, nenhum avaliador). O morador não ganha o cartão.
  Leitura que falha: sem cartão.
*/
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { vistoriaAtiva } from "./chave";
import { STATUS_PEDIDO_EM_CURSO, ehDonoParaAPorta, hrefDoCartaoDaAvaliacao, type ImovelNaPorta } from "./porta-da-avaliacao";

export interface PortaDaAvaliacao {
  /** A avaliação está aberta para esta conta (chave global, laboratório ou piloto). */
  chaveAberta: boolean;
  /** A cidade do imóvel mais recente da conta (para o estado honesto); null sem imóvel. */
  cidade: string | null;
  /** Os imóveis da conta, do mais recente para o mais antigo. Com a chave fechada, `emCurso` é sempre false. */
  imoveis: ImovelNaPorta[];
}

/**
 * A porta da avaliação para a conta da sessão. Devolve null quando não há sessão, quando a conta não é de dono (o
 * morador não tem porta) ou quando uma leitura falha.
 */
export async function portaDaAvaliacao(): Promise<PortaDaAvaliacao | null> {
  try {
    const supabase = await createClient();
    if (!supabase) return null;
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;
    const [{ data: props, error: erroProps }, { data: perfil, error: erroPerfil }] = await Promise.all([
      supabase.from("properties").select("id, title, city").eq("owner_id", user.id).order("created_at", { ascending: false }).limit(50),
      supabase.from("profiles").select("role").eq("id", user.id).maybeSingle(),
    ]);
    if (erroProps || erroPerfil) return null;
    const linhas = (props ?? []) as { id: string; title: string | null; city: string | null }[];
    if (!ehDonoParaAPorta({ imoveis: linhas.length, role: (perfil as { role?: string | null } | null)?.role ?? null })) return null;
    const chaveAberta = await vistoriaAtiva();
    const emCurso = new Set<string>();
    if (chaveAberta && linhas.length) {
      const admin = createAdminClient();
      if (!admin) return null;
      const { data: pedidos, error: erroPedidos } = await admin
        .from("vistoria_pedidos")
        .select("property_id")
        .eq("owner_id", user.id)
        .in("property_id", linhas.map((l) => l.id))
        .in("status", [...STATUS_PEDIDO_EM_CURSO]);
      if (erroPedidos) return null;
      for (const p of (pedidos ?? []) as { property_id: string }[]) emCurso.add(p.property_id);
    }
    return {
      chaveAberta,
      cidade: linhas.find((l) => l.city)?.city ?? null,
      imoveis: linhas.map((l) => ({ id: l.id, titulo: (l.title ?? "").trim() || "Imóvel sem título", cidade: l.city, emCurso: emCurso.has(l.id) })),
    };
  } catch {
    return null;
  }
}

/** O cartão da grade de Serviços: de todo dono. O destino é decidido pela regra pura (pedido em curso → o pedido; senão, a porta). */
export async function avaliacaoNaGrade(): Promise<{ href: string } | null> {
  const porta = await portaDaAvaliacao();
  if (!porta) return null;
  return { href: hrefDoCartaoDaAvaliacao({ chaveAberta: porta.chaveAberta, imoveis: porta.imoveis }) };
}
