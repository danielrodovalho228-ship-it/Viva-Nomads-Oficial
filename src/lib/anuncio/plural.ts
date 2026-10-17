/* Plural certo dos números do anúncio (ordem dd15064d, D7b): "1 quarto", "2 quartos". Função única. */
const pluralPt = (n: number, singular: string, plural: string) => `${n} ${n === 1 ? singular : plural}`;

export const quartosTexto = (n: number) => pluralPt(n, "quarto", "quartos");
export const banheirosTexto = (n: number) => pluralPt(n, "banheiro", "banheiros");
