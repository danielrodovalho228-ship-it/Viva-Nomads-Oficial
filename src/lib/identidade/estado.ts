/*
  Identidade: UMA fonte só para o estado, em todas as telas (complemento do prompt 23 — resíduo do reteste do 25,
  18/10). PURO e testável. Lê o laudo mais recente e devolve um de quatro estados, com o texto pronto:
   1. confirmada  → "Identidade confirmada · válida até dd/mm/aaaa"
   2. vencida     → "Identidade vencida em dd/mm/aaaa · Confirmar de novo"
   3. simulavel   → "Verificar identidade (simulado — conta de teste)"  (conta is_teste sem laudo válido)
   4. em_breve    → "Em breve, por meio de um parceiro"                  (conta real, CAF ainda não ativa)
  Nenhuma tela escreve o próprio texto: Conta › Confiança e segurança, /dashboard/verificacao, a etapa de identidade
  do anúncio, o cartão da Visão geral do inquilino, o cartão do candidato e a coluna "Identidade" do admin usam esta
  função (a do servidor é estadoIdentidade, em estado-servidor.ts).
*/
import { resumoDoLaudo, type LaudoCafGravado } from "../documento/conferencia-matricula.ts";

export type ChaveIdentidade = "confirmada" | "vencida" | "simulavel" | "em_breve";

export interface EstadoIdentidade {
  estado: ChaveIdentidade;
  texto: string;
  /** Laudo válido: até quando vale (ISO). */
  validoAte: string | null;
  /** Laudo que deixou de valer: desde quando (ISO). */
  vencidaEm: string | null;
  /** O que a pessoa pode fazer: confirmar (simulado ou de novo) ou nada. */
  acao: { texto: string; href: string } | null;
}

/** "18/10/2027" no fuso de Brasília. */
export function dataIdentidade(iso: string | null | undefined): string {
  const d = new Date(String(iso ?? ""));
  return Number.isFinite(d.getTime()) ? d.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" }) : "";
}

const TEXTO_EM_BREVE = "Em breve, por meio de um parceiro";
const TEXTO_SIMULAVEL = "Verificar identidade (simulado — conta de teste)";

/**
 * @param laudo   o laudo mais recente da pessoa (ou null)
 * @param simulavel  conta de teste (is_teste) ou laboratório: pode fazer a verificação simulada
 */
export function estadoIdentidadeDe(laudoGravado: LaudoCafGravado | null, simulavel: boolean, agora: Date): EstadoIdentidade {
  // Laudo SIMULADO numa conta que não pode simular (conta real em produção) não conta para nada: nem confirmada, nem vencida.
  const laudo = laudoGravado && laudoGravado.caf_result?.simulado === true && !simulavel ? null : laudoGravado;
  const r = resumoDoLaudo(laudo, agora, simulavel);
  if (r.feita && r.ok && laudo) {
    const ate = laudo.valid_until ?? null;
    const d = dataIdentidade(ate);
    return { estado: "confirmada", texto: d ? `Identidade confirmada · válida até ${d}` : "Identidade confirmada", validoAte: ate, vencidaEm: null, acao: null };
  }
  if (laudo && laudo.caf_result && !r.feita) {
    const quando = laudo.valid_until ?? laudo.created_at;
    const d = dataIdentidade(quando);
    return {
      estado: "vencida",
      texto: d ? `Identidade vencida em ${d} · Confirmar de novo` : "Identidade vencida · Confirmar de novo",
      validoAte: null,
      vencidaEm: quando,
      acao: { texto: "Confirmar de novo", href: "/dashboard/verificacao" },
    };
  }
  if (simulavel) return { estado: "simulavel", texto: TEXTO_SIMULAVEL, validoAte: null, vencidaEm: null, acao: { texto: TEXTO_SIMULAVEL, href: "/dashboard/verificacao" } };
  return { estado: "em_breve", texto: TEXTO_EM_BREVE, validoAte: null, vencidaEm: null, acao: null };
}
