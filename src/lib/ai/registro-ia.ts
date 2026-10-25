import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { GERACAO_IA_ATIVA } from "@/lib/flags";
import { integracoesSimuladas } from "@/lib/integracoes";
import { iaCadastroLigada, type MotivoFalhaIa, type RotaIa } from "@/lib/ai/falha-ia";

/*
  Registro das chamadas de IA do cadastro (prompt 22, tabela ia_chamadas — 0163). SEM dado pessoal: nada de usuário,
  nome, CPF, endereço ou conteúdo — só rota, ok, status, tipo do erro, motivo, modelo, tipo/tamanho do arquivo e
  duração. Nunca derruba a rota: falhou ao gravar, fica só o log do servidor.
*/

export interface ChamadaIa {
  rota: RotaIa;
  ok: boolean;
  status?: number | null;
  tipoErro?: string | null;
  motivo?: MotivoFalhaIa | null;
  modelo?: string | null;
  arquivoMime?: string | null;
  arquivoBytes?: number | null;
  reduzido?: boolean;
  duracaoMs?: number | null;
  /** Prompt 25: mensagem do erro da API (até 300 caracteres, sem dado pessoal). */
  erroResumo?: string | null;
}

export async function registrarChamadaIa(c: ChamadaIa): Promise<void> {
  const linha = {
    rota: c.rota,
    ok: c.ok,
    status: c.status ?? null,
    tipo_erro: c.tipoErro ? c.tipoErro.slice(0, 60) : null,
    motivo: c.motivo ?? null,
    modelo: c.modelo ? c.modelo.slice(0, 60) : null,
    arquivo_mime: c.arquivoMime ? c.arquivoMime.slice(0, 40) : null,
    arquivo_bytes: typeof c.arquivoBytes === "number" ? Math.max(0, Math.round(c.arquivoBytes)) : null,
    reduzido: c.reduzido === true,
    duracao_ms: typeof c.duracaoMs === "number" ? Math.max(0, Math.round(c.duracaoMs)) : null,
    erro_resumo: c.erroResumo ? c.erroResumo.slice(0, 300) : null,
  };
  // Log do servidor (Vercel) com os MESMOS campos, para quando a tabela ainda não existir.
  if (!c.ok) console.warn("[ia-cadastro] falha", JSON.stringify(linha));
  try {
    const admin = createAdminClient();
    if (!admin) return;
    let { error } = await admin.from("ia_chamadas").insert(linha);
    // Sem a 0166 (coluna erro_resumo) o registro continua sendo gravado, sem a mensagem.
    if (error && /erro_resumo/.test(error.message)) {
      const { erro_resumo: _semColuna, ...semResumo } = linha;
      void _semColuna;
      ({ error } = await admin.from("ia_chamadas").insert(semResumo));
    }
    if (error) console.warn("[ia-cadastro] não gravou o registro:", error.message);
  } catch (e) {
    console.warn("[ia-cadastro] não gravou o registro:", e instanceof Error ? e.message : "erro");
  }
}

/** A IA do cadastro (fotos) está ligada neste servidor? A leitura de documento só precisa da chave. */
export function iaCadastroLigadaAqui(): { fotos: boolean; documento: boolean } {
  const chave = !!process.env.ANTHROPIC_API_KEY;
  const simulado = integracoesSimuladas();
  return {
    fotos: iaCadastroLigada({ simulado, flag: GERACAO_IA_ATIVA, chave }),
    documento: simulado || chave,
  };
}

export interface ResumoIaCadastro {
  ligada: { fotos: boolean; documento: boolean };
  /** Faltam ao ligar (nomes das variáveis, nunca os valores). */
  faltam: string[];
  ultimaOk: { rota: RotaIa; em: string } | null;
  ultimoErro: { rota: RotaIa; em: string; status: number | null; tipo: string | null; motivo: MotivoFalhaIa | null; resumo: string | null } | null;
  /** Últimas 24 h: chamadas e falhas. null = tabela 0163 ainda não aplicada. */
  dia: { total: number; falhas: number } | null;
}

/** Painel "IA do cadastro" do /admin. */
export async function resumoIaCadastro(): Promise<ResumoIaCadastro> {
  const ligada = iaCadastroLigadaAqui();
  const faltam = [
    !integracoesSimuladas() && !GERACAO_IA_ATIVA ? "NEXT_PUBLIC_GERACAO_IA=on" : null,
    !integracoesSimuladas() && !process.env.ANTHROPIC_API_KEY ? "ANTHROPIC_API_KEY" : null,
  ].filter((x): x is string => !!x);
  const admin = createAdminClient();
  if (!admin) return { ligada, faltam, ultimaOk: null, ultimoErro: null, dia: null };
  const desde = new Date(Date.now() - 24 * 3_600_000).toISOString();
  // Último erro com a mensagem da API (0166); sem a coluna, a mesma consulta sem ela.
  type LinhaErro = { rota: string; criada_em: string; status: number | null; tipo_erro: string | null; motivo: string | null; erro_resumo?: string | null };
  const ultimoErro = async (): Promise<{ data: LinhaErro | null }> => {
    const q = async (cols: string) => {
      const r = await admin.from("ia_chamadas").select(cols).eq("ok", false).order("criada_em", { ascending: false }).limit(1).maybeSingle();
      return { data: (r.data as unknown as LinhaErro | null) ?? null, error: r.error };
    };
    const comResumo = await q("rota, criada_em, status, tipo_erro, motivo, erro_resumo");
    return comResumo.error ? q("rota, criada_em, status, tipo_erro, motivo") : comResumo;
  };
  const [ok, erro, total, falhas] = await Promise.all([
    admin.from("ia_chamadas").select("rota, criada_em").eq("ok", true).order("criada_em", { ascending: false }).limit(1).maybeSingle(),
    ultimoErro(),
    admin.from("ia_chamadas").select("id", { count: "exact", head: true }).gte("criada_em", desde),
    admin.from("ia_chamadas").select("id", { count: "exact", head: true }).gte("criada_em", desde).eq("ok", false),
  ]);
  if (ok.error || total.error) return { ligada, faltam, ultimaOk: null, ultimoErro: null, dia: null };
  return {
    ligada,
    faltam,
    ultimaOk: ok.data ? { rota: ok.data.rota as RotaIa, em: ok.data.criada_em as string } : null,
    ultimoErro: erro.data
      ? {
          rota: erro.data.rota as RotaIa,
          em: erro.data.criada_em as string,
          status: (erro.data.status as number | null) ?? null,
          tipo: (erro.data.tipo_erro as string | null) ?? null,
          motivo: (erro.data.motivo as MotivoFalhaIa | null) ?? null,
          resumo: erro.data.erro_resumo ?? null,
        }
      : null,
    dia: { total: total.count ?? 0, falhas: falhas.count ?? 0 },
  };
}
