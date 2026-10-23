import "server-only";
/*
  Prompt 59-A — o que a página PÚBLICA do imóvel mostra do 59: se o dono confirmou o padrão mínimo e a taxa de solução
  de manutenção no prazo do dono (12 meses; só com 3 ou mais chamados resolvidos). Leitura com a chave de serviço, só
  contagens: nenhum texto de chamado nem dado do morador sai daqui. Sem banco (demo) ou erro → nada é mostrado.
*/
import { createAdminClient } from "@/lib/supabase/admin";
import { estadoConfortoDoImovel } from "@/lib/conforto/servidor";
import { taxaSolucaoNoPrazo, type OrdemSolucao } from "@/lib/manutencao-solucao";

export interface Exibicao59 {
  confortoConfirmado: boolean;
  taxaManutencao: { taxa: number; resolvidos: number } | null;
}

const NADA: Exibicao59 = { confortoConfirmado: false, taxaManutencao: null };

export async function exibicao59DoImovel(propertyId: string, donoId: string | undefined, agora = new Date()): Promise<Exibicao59> {
  const admin = createAdminClient();
  if (!admin || !/^[0-9a-f-]{36}$/i.test(propertyId)) return NADA;
  try {
    const desde = new Date(agora.getTime() - 400 * 86_400_000).toISOString();
    const [conforto, ordens] = await Promise.all([
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
    ]);
    type Linha = { priority: OrdemSolucao["priority"]; status: string; opened_at: string; provisoria_em: string | null; solucao_marcada_em: string | null; resolved_at: string | null; simulacao: boolean | null };
    const lista: OrdemSolucao[] = ((ordens.data ?? []) as unknown as Linha[])
      .filter((o) => !o.simulacao)
      .map((o) => ({ priority: o.priority, status: o.status, openedAt: o.opened_at, provisoriaEm: o.provisoria_em, solucaoMarcadaEm: o.solucao_marcada_em, resolvedAt: o.resolved_at }));
    const t = taxaSolucaoNoPrazo(lista, agora);
    return { confortoConfirmado: conforto.completo, taxaManutencao: t ? { taxa: t.taxa, resolvidos: t.resolvidos } : null };
  } catch {
    return NADA;
  }
}
