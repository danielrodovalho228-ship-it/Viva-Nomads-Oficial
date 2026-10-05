import { hojeBR } from "@/lib/utils";
import { resolverPeriodo } from "@/lib/admin/visao-geral";
import { cidadesComAnuncio } from "@/lib/data/admin-visao-geral";
import { getFinanceiro } from "@/lib/data/admin-financeiro";
import { FinanceiroClient } from "./financeiro-client";

export const metadata = { title: "Financeiro — Admin" };

/** /admin/financeiro (PR C). O layout já exige admin; a leitura confere de novo. */
export default async function AdminFinanceiroPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const um = (k: string) => {
    const v = sp[k];
    return typeof v === "string" ? v : null;
  };
  const periodo = resolverPeriodo({ periodo: um("periodo"), de: um("de"), ate: um("ate") }, hojeBR());
  const cidade = (um("cidade") ?? "").trim().slice(0, 80) || null;
  const [r, cidades] = await Promise.all([getFinanceiro(periodo.inicio, periodo.fim, cidade), cidadesComAnuncio()]);
  const aviso = r.ok
    ? null
    : {
        demo: "Sem conexão com o banco (modo demonstração): nenhum número real para mostrar.",
        sem_permissao: "Sem permissão para ver o financeiro.",
        sem_chave: "Chave de serviço não configurada (SUPABASE_SERVICE_ROLE_KEY): os números não podem ser lidos.",
        sem_migracao: "O financeiro ainda não existe no banco (migração 0071 pendente).",
        erro: "Não foi possível ler os números agora.",
      }[r.motivo];
  return (
    <FinanceiroClient
      dados={r.ok ? r.dados : null}
      geradoEm={r.ok ? r.geradoEm : null}
      aviso={aviso}
      periodo={periodo}
      cidade={cidade}
      cidades={cidades}
    />
  );
}
