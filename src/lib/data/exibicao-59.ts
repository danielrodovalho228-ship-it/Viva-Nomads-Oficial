import "server-only";
/*
  Prompt 59-A — o que a página PÚBLICA do imóvel mostra do 59: se o dono confirmou o padrão mínimo e a taxa de solução
  de manutenção no prazo do dono (12 meses; só com 3 ou mais chamados resolvidos). Leitura com a chave de serviço, só
  contagens: nenhum texto de chamado nem dado do morador sai daqui. Sem banco (demo) ou erro → nada é mostrado.
*/
import { createAdminClient } from "@/lib/supabase/admin";
import { estadoConfortoDoImovel } from "@/lib/conforto/servidor";
import { taxaSolucaoNoPrazo, type OrdemSolucao } from "@/lib/manutencao-solucao";
import type { Area, ClasseRuido, Nivel, NivelOuAdequacao } from "@/config/niveis";
import { exibicaoDoImovel } from "@/lib/vistoria/laudo-servidor";
import type { ExibicaoAvaliacao } from "@/lib/vistoria/laudo";

/** Adendo 59.1 — o nível gravado (elo mais fraco), as áreas acima dele, o ruído e os extras. */
export interface NivelNaFicha {
  nivel: NivelOuAdequacao;
  vistoriado: boolean;
  diferenciais: { area: Area; nivel: Nivel }[];
  ruidoClasse: ClasseRuido | null;
  isolamento: boolean;
  extras: string[];
}

export interface Exibicao59 {
  confortoConfirmado: boolean;
  taxaManutencao: { taxa: number; resolvidos: number } | null;
  nivel?: NivelNaFicha | null;
  /** Prompt 62-B2: dados do "· vistoriado" (nível, data, nº do avaliador, resumo por grupo, link do /conferir). A Pista A desenha. */
  avaliacao?: ExibicaoAvaliacao | null;
}

const NADA: Exibicao59 = { confortoConfirmado: false, taxaManutencao: null, nivel: null, avaliacao: null };

export async function exibicao59DoImovel(propertyId: string, donoId: string | undefined, agora = new Date()): Promise<Exibicao59> {
  const admin = createAdminClient();
  if (!admin || !/^[0-9a-f-]{36}$/i.test(propertyId)) return NADA;
  try {
    const desde = new Date(agora.getTime() - 400 * 86_400_000).toISOString();
    const [conforto, ordens, nivel, avaliacao] = await Promise.all([
      estadoConfortoDoImovel(admin, propertyId, agora),
      donoId
        ? admin
            .from("service_orders")
            .select("priority, status, opened_at, provisoria_em, solucao_marcada_em, resolved_at, simulacao, properties!inner(owner_id)")
            .eq("properties.owner_id", donoId)
            .eq("status", "resolvido")
            .gte("opened_at", desde)
            .limit(2000)
        : Promise.resolve({ data: [] }),
      nivelDoImovelNaFicha(admin, propertyId),
      exibicaoDoImovel(admin, propertyId, agora).catch(() => null), // sem a 0216: sem laudo
    ]);
    type Linha = { priority: OrdemSolucao["priority"]; status: string; opened_at: string; provisoria_em: string | null; solucao_marcada_em: string | null; resolved_at: string | null; simulacao: boolean | null };
    const lista: OrdemSolucao[] = ((ordens.data ?? []) as unknown as Linha[])
      .filter((o) => !o.simulacao)
      .map((o) => ({ priority: o.priority, status: o.status, openedAt: o.opened_at, provisoriaEm: o.provisoria_em, solucaoMarcadaEm: o.solucao_marcada_em, resolvedAt: o.resolved_at }));
    const t = taxaSolucaoNoPrazo(lista, agora);
    return { confortoConfirmado: conforto.completo, taxaManutencao: t ? { taxa: t.taxa, resolvidos: t.resolvidos } : null, nivel, avaliacao };
  } catch {
    return NADA;
  }
}

/** Nível, ruído e extras do imóvel (sem a 0213 ou sem nível calculado: null, e a ficha não mostra o bloco). */
async function nivelDoImovelNaFicha(admin: NonNullable<ReturnType<typeof createAdminClient>>, propertyId: string): Promise<NivelNaFicha | null> {
  try {
    const [n, r, e] = await Promise.all([
      admin.from("imovel_nivel").select("nivel, diferenciais, ruido_classe, nivel_vistoriado_em").eq("property_id", propertyId).maybeSingle(),
      admin.from("imovel_ruido").select("isolamento_acustico").eq("property_id", propertyId).maybeSingle(),
      admin.from("imovel_extras").select("chave").eq("property_id", propertyId),
    ]);
    if (!n.data) return null;
    return {
      nivel: n.data.nivel as NivelOuAdequacao,
      vistoriado: !!n.data.nivel_vistoriado_em,
      diferenciais: Array.isArray(n.data.diferenciais) ? (n.data.diferenciais as { area: Area; nivel: Nivel }[]) : [],
      ruidoClasse: (n.data.ruido_classe as ClasseRuido | null) ?? null,
      isolamento: !!r.data?.isolamento_acustico,
      extras: ((e.data ?? []) as { chave: string }[]).map((x) => x.chave),
    };
  } catch {
    return null;
  }
}
