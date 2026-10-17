/** Limite de caracteres da meta description que o Google mostra inteira. */
const LIMITE_META = 155;

/** Meta description da página da cidade (Google, IA, redes). Sem o verbo "alugar" (vocabulário da marca). */
export function descricaoCidade(nome: string): string {
  const base = `Imóveis mobiliados para estadias de 30 a 180 dias em ${nome}.`;
  const completa = `${base} Para profissionais em transição: executivos, médicos, famílias e nômades digitais.`;
  // Cidade de nome longo: mantém só a frase curta, para a descrição não ser cortada.
  return completa.length <= LIMITE_META ? completa : `${base} Para profissionais em transição.`;
}
