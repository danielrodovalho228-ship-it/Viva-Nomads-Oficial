/*
  Identidade: UMA fonte só para o estado, em todas as telas (complemento do prompt 23 — resíduo do reteste do 25,
  18/10). PURO e testável. Lê o laudo mais recente e devolve um de quatro estados, com o texto pronto:
   1. confirmada  → "Identidade confirmada · válida até dd/mm/aaaa"
   2. vencida     → "Identidade vencida em dd/mm/aaaa · Confirmar de novo"
   3. simulavel   → "Verificar identidade (simulado — conta de teste)"  (conta is_teste sem laudo válido)
   4. em_breve    → "Conferida pela equipe da Viva"                       (conta real, CAF ainda não ativa)
   6. conferida_equipe → "Conferida pela equipe da Viva"                  (E1106: sem laudo válido, com a conferência
      manual da equipa no registo — profiles.is_verified, lido aqui como INSUMO; as telas não o leem directamente)
  Precedência (E1106): laudo válido → confirmada; sem ele, conferência da equipa → conferida_equipe; senão, os de sempre.
   5. indisponivel → "Identidade não conferida agora"                     (a leitura falhou; só para a outra parte)
  E152: nada de prometer função futura ("em breve, com um parceiro"): o texto diz o caminho de HOJE.
  Nenhuma tela escreve o próprio texto: Conta › Confiança e segurança, /dashboard/verificacao, a etapa de identidade
  do anúncio, o cartão da Visão geral do inquilino, o cartão do candidato e a coluna "Identidade" do admin usam esta
  função (a do servidor é estadoIdentidade, em estado-servidor.ts).
*/
import { resumoDoLaudo, type LaudoCafGravado } from "../documento/conferencia-matricula.ts";

/** "indisponivel": a leitura falhou — só para a OUTRA PARTE (nunca vira "pendente" nem "não verificada" por engano). */
export type ChaveIdentidade = "confirmada" | "vencida" | "simulavel" | "em_breve" | "indisponivel" | "conferida_equipe";

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

export const TEXTO_EM_BREVE = "Conferida pela equipe da Viva";
/** E1106 (ORDEM-DUET-478): o texto do estado da conferência manual da equipa. */
export const TEXTO_CONFERIDA_EQUIPE = "Conferida pela equipe da Viva";

/**
 * E1106: fora do selo, a conferência da equipa segue o caminho do `em_breve` de hoje — pendência que não impede nada.
 * Assim nenhuma tela passa a bloquear quem hoje não bloqueava.
 */
export function comoEmBreve(estado: ChaveIdentidade | string | null | undefined): boolean {
  return estado === "em_breve" || estado === "conferida_equipe";
}
const TEXTO_SIMULAVEL = "Verificar identidade (simulado — conta de teste)";

/**
 * @param laudo   o laudo mais recente da pessoa (ou null)
 * @param simulavel  conta de teste (is_teste) ou laboratório: pode fazer a verificação simulada
 * @param conferidaEquipe  E1106: a conferência manual da equipa está no registo (profiles.is_verified)
 */
export function estadoIdentidadeDe(laudoGravado: LaudoCafGravado | null, simulavel: boolean, agora: Date, conferidaEquipe = false): EstadoIdentidade {
  // Laudo SIMULADO numa conta que não pode simular (conta real em produção) não conta para nada: nem confirmada, nem vencida.
  const laudo = laudoGravado && laudoGravado.caf_result?.simulado === true && !simulavel ? null : laudoGravado;
  const r = resumoDoLaudo(laudo, agora, simulavel);
  if (r.feita && r.ok && laudo) {
    const ate = laudo.valid_until ?? null;
    const d = dataIdentidade(ate);
    return { estado: "confirmada", texto: d ? `Identidade confirmada · válida até ${d}` : "Identidade confirmada", validoAte: ate, vencidaEm: null, acao: null };
  }
  // E1106: sem laudo válido, a conferência manual da equipa vence os estados de sempre (vencida, simulavel, em_breve).
  if (conferidaEquipe) return { estado: "conferida_equipe", texto: TEXTO_CONFERIDA_EQUIPE, validoAte: null, vencidaEm: null, acao: null };
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

/**
 * PROP-3 (E118): o que a OUTRA PARTE vê (o dono em Interessados e no Fechamento) — UMA função para as duas telas.
 * Só dois estados: verificada (laudo válido) ou pendente. Os textos "para mim" (simulado, em breve, confirmar de novo)
 * nunca aparecem como status de outra pessoa.
 */
export const IDENTIDADE_INDISPONIVEL: EstadoIdentidade = {
  estado: "indisponivel",
  texto: "Identidade não conferida agora",
  validoAte: null,
  vencidaEm: null,
  acao: null,
};

export function identidadeParaOutraParte(e: EstadoIdentidade | null | undefined): { verificada: boolean; rotulo: string } {
  if (e?.estado === "indisponivel") return { verificada: false, rotulo: IDENTIDADE_INDISPONIVEL.texto };
  return e?.estado === "confirmada" ? { verificada: true, rotulo: "Identidade verificada" } : { verificada: false, rotulo: "Identidade pendente" };
}
