/*
  Prompt 59-A — textos de exibição do padrão mínimo e do compromisso de manutenção. Tudo sai das constantes do 59
  (src/config/conforto-minimo.ts e PRAZO_SOLUCAO_H): mudou um prazo, o texto do anúncio muda junto.
*/
import { COMO_ACIONAR_MANUTENCAO, SE_O_PRAZO_VENCER, linhasReguaManutencao } from "../../config/atendimento.ts";
import { ITENS_CONFORTO } from "../../config/conforto-minimo.ts";
import { TAXA_MIN_RESOLVIDOS } from "../manutencao-solucao.ts";

/** Linha da página do imóvel quando o dono confirmou todos os itens. */
export const TEXTO_PADRAO_CONFIRMADO = "Padrão mínimo da Viva: confirmado pelo proprietário";

/** Título do bloco de confirmação no cadastro. */
export const TITULO_PADRAO_MINIMO = "Padrão mínimo da Viva";

/**
 * E817: o compromisso de manutenção do anúncio é a RÉGUA ÚNICA (config/atendimento.ts), a mesma da Central de Ajuda:
 * "Manutenção: Urgente (…): resposta em até 4 h, solução provisória em até 24 h e definitiva em até 72 h · Média (…) ·
 * Baixa (…) · Quem resolve é o proprietário… · Se o prazo de solução vencer…". Separado por " · " (o "Bom saber" lê assim).
 */
export function textoCompromissoManutencao(): string {
  return `Manutenção: ${[...linhasReguaManutencao().map((l) => l.texto), COMO_ACIONAR_MANUTENCAO, SE_O_PRAZO_VENCER].join(" · ")}`;
}

/** "Manutenção resolvida no prazo: 83%" — só com a taxa calculada (3 ou mais chamados resolvidos); senão, nada. */
export function rotuloTaxaManutencao(t: { taxa: number; resolvidos: number } | null | undefined): string | null {
  if (!t || t.resolvidos < TAXA_MIN_RESOLVIDOS || !Number.isFinite(t.taxa)) return null;
  return `Manutenção resolvida no prazo: ${Math.round(t.taxa * 100)}%`;
}

/** Itens do padrão mínimo ainda não marcados, na ordem da lista. */
export function itensNaoConfirmados(marcados: readonly string[]): { chave: string; rotulo: string }[] {
  const sel = new Set(marcados);
  return ITENS_CONFORTO.filter((i) => !sel.has(i.chave)).map((i) => ({ chave: i.chave, rotulo: i.rotulo }));
}

/** "Falta confirmar: Água quente, Iluminação." — ou null quando está tudo confirmado. */
export function textoFaltaConfirmar(marcados: readonly string[]): string | null {
  const faltam = itensNaoConfirmados(marcados);
  if (!faltam.length) return null;
  return `Falta confirmar: ${faltam.map((i) => i.rotulo).join(", ")}.`;
}
