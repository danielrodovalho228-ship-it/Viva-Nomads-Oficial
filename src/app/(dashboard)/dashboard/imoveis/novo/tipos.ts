/** Quais campos vieram de sugestão (IA ou estimativa) — some a marca quando o dono mexe no campo. */
export type CampoSugerido = "tipo" | "quartos" | "banheiros" | "capacidade" | "titulo" | "descricao" | "mobiliado" | "consumo" | "preco";

export type EstadoIaFotos = "parada" | "analisando" | "feita" | "sem_sugestoes" | "erro";

/** Prompt 22: por que a IA das fotos não sugeriu nada (a tela mostra o texto e "Tentar de novo"). */
export interface FalhaIaFotos {
  motivo: import("@/lib/ai/falha-ia").MotivoFalhaIa;
  texto: string;
}
