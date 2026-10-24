/*
  FOTO-PERFIL-B (E13) — regra da foto de perfil e da fila de revisão. PURO, node --test.
  A foto do perfil é o ROSTO do titular adulto da conta: não valem criança, logo, paisagem, animal, grupo nem foto de
  outra pessoa. A revisão é DEPOIS de publicar (a foto nova já aparece, com a regra de visibilidade do E14).
*/

export const REGRA_FOTO_PERFIL = "A foto do perfil é o seu rosto: só você, adulto, de frente. Sem crianças, logo, paisagem, animal, grupo ou foto de outra pessoa.";

/** Lista FECHADA de motivos de remoção (o banco confere a mesma lista na 0244). */
export const MOTIVOS_REMOCAO_FOTO = [
  "Não mostra um rosto",
  "Parece ser de criança ou adolescente",
  "Mais de uma pessoa",
  "Não parece ser você",
  "Imagem imprópria",
] as const;
export type MotivoRemocaoFoto = (typeof MOTIVOS_REMOCAO_FOTO)[number];

export function motivoRemocaoValido(m: unknown): m is MotivoRemocaoFoto {
  return typeof m === "string" && (MOTIVOS_REMOCAO_FOTO as readonly string[]).includes(m);
}

/** Motivo da denúncia na Central de Ajuda (categoria 'foto_perfil', contexto 'perfil'). */
export const MOTIVO_DENUNCIA_FOTO = "Foto de perfil inadequada";
export const ENVIAR_OUTRA_FOTO = "Enviar outra foto";
export const ROTULO_CONTADOR_FOTOS = "Fotos de perfil em revisão";

export type StatusFoto = "em_revisao" | "aprovada" | "removida";

export interface ItemFila {
  id: string;
  enviadaEm: string;
  denunciadaEm: string | null;
}

/** Ordem da fila: denunciadas no topo (a mais recente primeiro); depois a mais antiga primeiro. */
export function ordenarFila<T extends ItemFila>(itens: T[]): T[] {
  return [...itens].sort((a, b) => {
    if (a.denunciadaEm && b.denunciadaEm) return Date.parse(b.denunciadaEm) - Date.parse(a.denunciadaEm);
    if (a.denunciadaEm) return -1;
    if (b.denunciadaEm) return 1;
    return Date.parse(a.enviadaEm) - Date.parse(b.enviadaEm);
  });
}

/** O que a pessoa vê na Conta: o motivo da última remoção, enquanto não houver foto nova. */
export function avisoRemocao(ultima: { status: StatusFoto; motivo: string | null } | null, temFotoAgora: boolean): string | null {
  if (temFotoAgora || !ultima || ultima.status !== "removida") return null;
  return ultima.motivo;
}

/** Texto do e-mail/aviso da remoção (motivo da lista fechada — nunca texto livre). */
export function textoRemocao(motivo: MotivoRemocaoFoto, nome?: string): string {
  return `Olá${nome ? " " + nome : ""}, a equipe da Viva Nomads removeu a foto do seu perfil. Motivo: ${motivo}. ${REGRA_FOTO_PERFIL} Você pode enviar outra foto quando quiser.`;
}
