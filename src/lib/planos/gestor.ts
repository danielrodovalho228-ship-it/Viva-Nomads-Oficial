/**
 * Conta de ADMINISTRADORA (profiles.account_type = 'gestor') e a linha da taxa na Conta. Puro e client-safe.
 *
 * Prompt 078 (decisão do Daniel, 16/11/2026): o Plano Gestor de 4% deixou de ser oferta pública. O TIPO de conta fica —
 * identifica a administradora (por exemplo no filtro "gestor profissional" da busca) e é marcado pelo admin, com
 * auditoria —, mas não dá mais taxa nenhuma: vale a escada de lib/cobranca/regra.ts como para todos. Condição especial é
 * só a taxa fixada pelo admin, com motivo e validade. Saíram daqui gestorElegivel, faltamParaGestor, motivoGestor e
 * textoElegibilidadeGestor.
 */
import { pctTexto } from "../cobranca/regra.ts";
import { FRASE_ESCADA_TAXAS } from "../../config/textos-regulados.ts";

export type AccountType = "individual" | "gestor";

/**
 * A linha de Conta › Plano (proprietário): a taxa de serviço que vale hoje para a conta, a escada e a linha das
 * carteiras (FRASE_ESCADA_TAXAS, fonte única). `origem: "admin"` = taxa combinada com a Viva (fixada pelo admin).
 */
export function textoTaxaNaConta(t: { taxa: number; origem: "admin" | "faixa" | "faixa_com_queda_recente"; imoveisAtivos: number }): string {
  const quantos = t.imoveisAtivos === 1 ? "1 imóvel ativo" : `${t.imoveisAtivos} imóveis ativos`;
  const hoje =
    t.origem === "admin"
      ? `Sua taxa de serviço hoje é de ${pctTexto(t.taxa)}, combinada com a Viva.`
      : `Sua taxa de serviço hoje é de ${pctTexto(t.taxa)}${t.imoveisAtivos > 0 ? ` (${quantos})` : ""}.`;
  return `${hoje} ${FRASE_ESCADA_TAXAS}`;
}

/** E224 — como o admin vê o tipo da conta (os valores são os que definirAccountType aceita). */
export const ROTULO_TIPO_CONTA: Readonly<Record<AccountType, string>> = { individual: "individual", gestor: "administradora" };

/** Motivo da troca de tipo: obrigatório, com pelo menos 5 caracteres de texto. */
export const MOTIVO_TIPO_MIN = 5;
export function motivoTipoValido(m: string | null | undefined): boolean {
  return (m ?? "").trim().length >= MOTIVO_TIPO_MIN;
}
