/** Linha devolvida por `perfil_publico_dono` (migração 0131): só o que é público. */
export type PerfilPublicoDono = {
  nome: string | null;
  avatar_url: string | null;
  desde: string | null;
  taxa_resposta: number | null;
  verificado: boolean | null;
};

/** Primeira linha com nome — sem nome não há bloco "Proprietário" (função devolve vazio p/ anúncio inativo). */
export function primeiroPerfilPublico(linhas: PerfilPublicoDono[] | null | undefined): PerfilPublicoDono | null {
  const d = linhas?.[0];
  return d?.nome ? d : null;
}
