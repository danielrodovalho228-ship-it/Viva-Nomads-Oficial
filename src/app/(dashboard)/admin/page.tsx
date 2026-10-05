import { hojeBR } from "@/lib/utils";
import { resolverPeriodo } from "@/lib/admin/visao-geral";
import { getVisaoGeral, cidadesComAnuncio } from "@/lib/data/admin-visao-geral";
import { VisaoGeralClient } from "./visao-geral-client";

/**
 * Visão geral do /admin (PR B): período (7/30/90 dias, ano, personalizado)
 * com variação contra o período anterior, filtro de cidade, blocos de
 * indicadores com a fórmula no "i", funil, "Precisa de você agora" e CSV.
 * O layout já exige admin; a leitura confere de novo (getVisaoGeral).
 */
export default async function AdminPage({
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

  const [resultado, cidades] = await Promise.all([
    getVisaoGeral(periodo.inicio, periodo.fim, cidade),
    cidadesComAnuncio(),
  ]);

  const aviso = resultado.ok
    ? null
    : {
        demo: "Sem conexão com o banco (modo demonstração): nenhum número real para mostrar.",
        sem_permissao: "Sem permissão para ver os números da plataforma.",
        sem_chave: "Chave de serviço não configurada (SUPABASE_SERVICE_ROLE_KEY): os números não podem ser lidos.",
        sem_migracao: "A função da visão geral ainda não existe no banco (migração 0069 pendente).",
        erro: "Não foi possível ler os números agora.",
      }[resultado.motivo];

  return (
    <VisaoGeralClient
      dados={resultado.ok ? resultado.dados : null}
      aviso={aviso}
      periodo={periodo}
      cidade={cidade}
      cidades={cidades}
    />
  );
}
