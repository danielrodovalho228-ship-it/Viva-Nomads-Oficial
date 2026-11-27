/*
  Filtros pacote 1 (/buscar, folha "Mais filtros") — PURO. Dois interruptores novos e um chip de comodidade:
   • "Ambiente silencioso" (`?silencioso=1`): o ruído declarado pelo dono (imovel_nivel.ruido_classe, regra única de
     niveis/regras.ts). "baixo" passa; "medio"/"alto" só com janelas de isolamento acústico (imovel_ruido); sem
     classe (não declarado) NÃO passa — quem não informou não aparece no filtro, como nas comodidades.
   • "Contas incluídas" (`?contas=1`): a MESMA função do aviso do cartão (E899/E923, precos.ts situacaoDasContas) —
     só quando o cartão mostra o AVISO_TUDO_INCLUIDO: contas no modo fixo E com a estimativa dentro do total do mês. Contas fixas
     sem estimativa ("água, luz e gás não informados") não passam.
   • "Ar-condicionado": chip da lista COMODIDADES_FILTRO (filtro-comodidades.ts, amenityKey ar_condicionado).
  Roda: node --test src/lib/busca/filtros-pacote1.test.ts
*/
import { situacaoDasContas, type CamposDasContas } from "../precos.ts";

export type ClasseRuidoBusca = "baixo" | "medio" | "alto";

export interface ImovelSilencio {
  /** imovel_nivel.ruido_classe; null/ausente = o dono não declarou. */
  ruidoClasse?: ClasseRuidoBusca | null;
  /** imovel_ruido.isolamento_acustico (janelas de isolamento acústico). */
  isolamentoAcustico?: boolean;
}

/** O anúncio entra em "Ambiente silencioso"? Baixo passa; médio/alto só com isolamento; sem declaração, não. */
export function ambienteSilencioso(p: ImovelSilencio): boolean {
  if (p.ruidoClasse === "baixo") return true;
  if (p.ruidoClasse === "medio" || p.ruidoClasse === "alto") return p.isolamentoAcustico === true;
  return false;
}

/** O anúncio entra em "Contas incluídas"? Só quando o cartão mostra o AVISO_TUDO_INCLUIDO (situacaoDasContas = no_total). */
export function contasIncluidas(p: { utilitiesMode?: string; utilitiesEstimate?: number | null }): boolean {
  return situacaoDasContas({ utilitiesMode: p.utilitiesMode as CamposDasContas["utilitiesMode"], utilitiesEstimate: p.utilitiesEstimate }) === "no_total";
}

export const ROTULO_SILENCIOSO = "Ambiente silencioso";
export const DICA_SILENCIOSO = "Ruído baixo, ou médio/alto com janelas de isolamento acústico";
export const ROTULO_CONTAS_INCLUIDAS = "Contas incluídas";
export const DICA_CONTAS_INCLUIDAS = "Água, luz e gás já dentro do valor do mês";
