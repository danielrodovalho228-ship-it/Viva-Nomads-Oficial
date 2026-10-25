import { hojeBR } from "@/lib/utils";
import { resolverPeriodo } from "@/lib/admin/visao-geral";
import { recorteDaUrl } from "@/lib/admin/indicadores";
import { comissoesDosContratos } from "@/lib/admin/financeiro";
import { cidadesComAnuncio } from "@/lib/data/admin-visao-geral";
import { getFinanceiro } from "@/lib/data/admin-financeiro";
import { FinanceiroClient } from "./financeiro-client";
import { adminDaPagina, cobrancasTaxa, contratosReais, imovelDosLeads, intervaloBRT, taxasVencidas } from "@/lib/data/admin-indicadores";
import { tituloDoAdmin } from "@/config/menu-admin";

/** Aviso enquanto a 0183 não está no banco: diz o que falta e o que já segue o recorte (complemento do #897). */
const TEXTO_FINANCEIRO_SEM_0183 =
  "Assinaturas, MRR, recebido, marketing e os gráficos mensais aparecem quando a migração 0183 for aplicada (automática no merge). Contratos, taxa de serviço e take rate já seguem o recorte Real · Teste · Todos.";

export const metadata = { title: tituloDoAdmin("/admin/financeiro") };

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
  // Complemento do P29, item 3: UMA base para a página inteira — o mesmo seletor de /admin/contratos (padrão Real).
  const recorte = recorteDaUrl(um("tipo"));
  const soVencidas = um("situacao") === "vencida";
  const admin = await adminDaPagina();
  // Prompt 29, item 6: valor total, taxa e take rate saem da MESMA lista de contratos da home e de /admin/contratos.
  const [r, cidades, contratos, vencidas] = await Promise.all([
    getFinanceiro(periodo.inicio, periodo.fim, cidade, recorte),
    cidadesComAnuncio(),
    admin ? contratosReais(admin, intervaloBRT(periodo.inicio, periodo.fim), cidade, recorte).catch(() => null) : Promise.resolve(null),
    // "Taxas vencidas" da home (agora, sem período): a mesma função, com o recorte da página.
    admin && soVencidas ? taxasVencidas(admin, recorte).catch(() => []) : Promise.resolve(null),
  ]);
  const [cobrancas, imoveis] = await Promise.all([
    admin && contratos ? cobrancasTaxa(admin, contratos.map((c) => c.leadId ?? "")).catch(() => new Map()) : Promise.resolve(new Map()),
    admin && vencidas ? imovelDosLeads(admin, vencidas.map((v) => v.leadId)).catch(() => new Map<string, string>()) : Promise.resolve(new Map<string, string>()),
  ]);
  // A tabela de taxas sai da mesma lista dos cartões (nunca da lista da 0071, que não tem recorte).
  const dados = r.ok ? { ...r.dados, comissoes: contratos ? comissoesDosContratos(contratos, cobrancas) : [] } : null;
  const aviso = r.ok
    ? null
    : {
        demo: "Sem conexão com o banco (modo demonstração): nenhum número real para mostrar.",
        sem_permissao: "Sem permissão para ver o financeiro.",
        sem_chave: "Chave de serviço não configurada (SUPABASE_SERVICE_ROLE_KEY): os números não podem ser lidos.",
        sem_migracao: TEXTO_FINANCEIRO_SEM_0183,
        erro: "Não foi possível ler os números agora.",
      }[r.motivo];
  return (
    <FinanceiroClient
      dados={dados}
      geradoEm={r.ok ? r.geradoEm : null}
      aviso={aviso}
      periodo={periodo}
      cidade={cidade}
      cidades={cidades}
      contratos={contratos}
      recorte={recorte}
      vencidas={vencidas ? vencidas.map((v) => ({ ...v, imovel: imoveis.get(v.leadId) ?? "Imóvel" })) : null}
    />
  );
}
