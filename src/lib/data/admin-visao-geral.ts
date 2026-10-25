import { unstable_cache } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ehAdmin } from "@/lib/data/admin-guard";
import { diasAteHoje, type Metricas } from "@/lib/admin/visao-geral";
import { hojeBR } from "@/lib/utils";
import { chaveCidade } from "@/lib/cidades";
import { tipoImovel } from "@/lib/admin/indicadores";
import {
  candidaturasSemResposta48h,
  contadoresAgentes,
  extrasAtendimento,
  extrasDoPeriodo,
  filaDocumentos,
  idsContasTeste,
  pedidosExpirandoSemResposta,
  taxasVencidas,
  urgentesSemResposta4h,
} from "@/lib/data/admin-indicadores";

/**
 * Visão geral do /admin (0069). Confere ADMIN no servidor e só então lê a
 * função agregada admin_visao_geral pelo cliente de serviço, com CACHE de 5
 * minutos por (período, cidade) — o painel abre rápido e o banco não é
 * consultado a cada clique. Nada de dado pessoal: só números.
 */
export interface VisaoGeral {
  periodo: { inicio: string; fim: string; dias: number; inicio_anterior: string; fim_anterior: string; cidade: string | null };
  atual: Metricas;
  anterior: Metricas;
  serie: Record<string, unknown>[];
  agora: Metricas & { assinaturas?: Record<string, unknown> | null };
  precisa: Record<string, { n: unknown; horas_mais_antigo: unknown } | null>;
  /** Fila de documentos AGORA (Prompt 29, item 9): a mesma do selo da barra lateral e de /admin/documentos. */
  filaDocs: { documentos: number; matriculas: number; total: number; maisAntigoEm: string | null } | null;
  /** Agentes (item 10): os três números com nome. */
  agentes: { aguardandoOk: number; ordensPendentes: number; ordensLidas: number } | null;
  geradoEm: string;
}

export type ResultadoVisaoGeral =
  | { ok: true; dados: VisaoGeral }
  | { ok: false; motivo: "demo" | "sem_permissao" | "sem_chave" | "sem_migracao" | "erro" };

const lerCache = unstable_cache(
  async (inicio: string, fim: string, cidade: string | null): Promise<VisaoGeral | "sem_migracao" | "erro"> => {
    const admin = createAdminClient();
    if (!admin) return "erro";
    const { data, error } = await admin.rpc("admin_visao_geral", { p_inicio: inicio, p_fim: fim, p_cidade: cidade });
    if (error) {
      console.error("[admin] visão geral:", error.message);
      // Função ainda não existe (0069 não aplicada) → a tela explica.
      return error.code === "PGRST202" || /admin_visao_geral/.test(error.message) ? "sem_migracao" : "erro";
    }
    const base = data as Omit<VisaoGeral, "geradoEm" | "filaDocs" | "agentes">;
    // Prompt 29: os números que aparecem em mais de um lugar saem das funções "uma fonte só" (src/lib/admin/indicadores).
    const [xAtual, xAnterior, xAtd, filaDocs, agentes, demonstracaoTeste] = await Promise.all([
      extrasDoPeriodo(admin, inicio, fim, cidade),
      extrasDoPeriodo(admin, base.periodo.inicio_anterior, base.periodo.fim_anterior, cidade),
      extrasAtendimento(admin, diasAteHoje({ inicio }, hojeBR())),
      filaDocumentos(admin).catch(() => null),
      contadoresAgentes(admin).catch(() => null),
      imoveisDeTeste(admin, cidade),
    ]);
    const precisa = { ...base.precisa };
    // Complemento do P29 (item 4): as filas contam pela MESMA função da lista que cada uma abre.
    const horasDesde = (iso: string | undefined) => (iso ? Math.round((Date.now() - new Date(iso).getTime()) / 3_600_000) : null);
    const [cand48, urgentes, vencidas, expirando] = await Promise.all([
      candidaturasSemResposta48h(admin).catch(() => null),
      urgentesSemResposta4h(admin).catch(() => null),
      taxasVencidas(admin, "real").catch(() => null),
      pedidosExpirandoSemResposta(admin).catch(() => null),
    ]);
    if (cand48) precisa.candidaturas_sem_resposta_48h = { n: cand48.length, horas_mais_antigo: horasDesde(cand48[0]?.criadoEm) };
    if (urgentes) precisa.chamados_urgentes_sem_resposta = { n: urgentes.length, horas_mais_antigo: horasDesde(urgentes[0]?.opened_at) };
    if (vencidas) precisa.comissoes_vencidas = { n: vencidas.length, horas_mais_antigo: horasDesde([...vencidas].sort((a, b) => a.criadoEm.localeCompare(b.criadoEm))[0]?.criadoEm) };
    if (expirando) precisa.pedidos_sem_resposta_expirando = { n: expirando.length, horas_mais_antigo: null };
    if (filaDocs) {
      const horas = filaDocs.maisAntigoEm ? Math.round((Date.now() - new Date(filaDocs.maisAntigoEm).getTime()) / 3_600_000) : null;
      precisa.documentos_pendentes = { n: filaDocs.total, horas_mais_antigo: horas };
    }
    return {
      ...base,
      atual: { ...base.atual, ...xAtual, ...xAtd },
      anterior: { ...base.anterior, ...xAnterior },
      agora: { ...base.agora, x_imoveis_teste: demonstracaoTeste },
      precisa,
      filaDocs,
      agentes,
      geradoEm: new Date().toISOString(),
    };
  },
  ["admin-visao-geral"],
  { revalidate: 300, tags: ["admin-visao-geral"] }
);

/** Anúncios de TESTE ([TESTE…] ou de conta is_teste), para a home mostrar separado dos reais (item 13). */
async function imoveisDeTeste(admin: NonNullable<ReturnType<typeof createAdminClient>>, cidade: string | null): Promise<number | null> {
  const [{ data, error }, teste] = await Promise.all([admin.from("properties").select("id, title, owner_id, city").limit(5000), idsContasTeste(admin)]);
  if (error) return null;
  const k = cidade ? chaveCidade(cidade) : null;
  return ((data ?? []) as { id: string; title: string | null; owner_id: string; city: string | null }[]).filter(
    (p) => tipoImovel({ id: p.id, titulo: p.title, donoTeste: teste.has(p.owner_id) }) === "teste" && (!k || chaveCidade(p.city) === k)
  ).length;
}

export async function getVisaoGeral(inicio: string, fim: string, cidade: string | null): Promise<ResultadoVisaoGeral> {
  const supabase = await createClient();
  if (!supabase) return { ok: false, motivo: "demo" };
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !(await ehAdmin(supabase, user.id))) return { ok: false, motivo: "sem_permissao" };
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return { ok: false, motivo: "sem_chave" };
  const r = await lerCache(inicio, fim, cidade);
  if (r === "sem_migracao" || r === "erro") return { ok: false, motivo: r };
  return { ok: true, dados: r };
}

/** Cidades com anúncio (para o filtro). Só admin. */
export async function cidadesComAnuncio(): Promise<string[]> {
  const supabase = await createClient();
  if (!supabase) return [];
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !(await ehAdmin(supabase, user.id))) return [];
  const admin = createAdminClient();
  if (!admin) return [];
  const { data } = await admin.from("properties").select("city").not("city", "is", null).limit(2000);
  const vistas = new Map<string, string>();
  for (const r of data ?? []) {
    const c = String(r.city ?? "").trim();
    const k = c.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
    if (c && !vistas.has(k)) vistas.set(k, c);
  }
  return [...vistas.values()].sort((a, b) => a.localeCompare(b, "pt-BR"));
}
