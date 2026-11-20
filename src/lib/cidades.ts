/*
  Cidade sem duplicata por grafia ("Uberlândia" × "Uberlandia"). Módulo puro:
  a lista do IBGE entra por parâmetro (src/lib/municipios.ts a carrega).
*/

/** Chave de comparação: sem acento, minúscula, espaços únicos. */
export function chaveCidade(t: string | null | undefined): string {
  return String(t ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9' -]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** E782 (adendo): cidades da plataforma cujo nome digitado SEM acento ("Uberlandia", salvo no perfil em texto livre) se exibe com a grafia oficial. */
const GRAFIA_DAS_CIDADES: Readonly<Record<string, string>> = { uberlandia: "Uberlândia" };

/** Como mostrar a cidade que a pessoa digitou: a grafia oficial quando é uma cidade conhecida; qualquer outra, como veio. */
export function grafiaDaCidade(c: string | null | undefined): string {
  const t = String(c ?? "").trim();
  return GRAFIA_DAS_CIDADES[chaveCidade(t)] ?? t;
}

/** Nome OFICIAL (com acento) da cidade na lista da UF, ou null se não existe. */
export function acharCidade(lista: readonly string[] | undefined, nome: string): string | null {
  const k = chaveCidade(nome);
  if (!k || !lista) return null;
  return lista.find((c) => chaveCidade(c) === k) ?? null;
}

/** Mesma cidade, qualquer grafia/acentuação. */
export function mesmaCidade(a: string | null | undefined, b: string | null | undefined): boolean {
  const ka = chaveCidade(a);
  return !!ka && ka === chaveCidade(b);
}

/**
 * Título da contagem na página da cidade. Reais e exemplos nunca somam num número só:
 * "1 imóvel + 15 de exemplo" em vez de "16 imóveis".
 */
/**
 * E446: o NÚMERO do título da página da cidade é o da busca (a mesma função, `contagemDaBusca`: "15 imóveis em Uberlândia"); a
 * separação honesta entre reais e de exemplo vem numa linha embaixo (`detalheContagemCidade`), nunca no lugar do número.
 */
export function detalheContagemCidade(reais: number, exemplos: number): string | null {
  if (exemplos === 0) return null;
  if (reais === 0) return `Todos são anúncios de exemplo (marcados em cada cartão).`;
  return `${reais} ${reais === 1 ? "é um imóvel real" : "são imóveis reais"} e ${exemplos} ${exemplos === 1 ? "é de exemplo" : "são de exemplo"}.`;
}

/** Título que separa reais e de exemplo (não é mais o título da página da cidade: veja `contagemDaBusca` + `detalheContagemCidade`). */
export function tituloContagemCidade(reais: number, exemplos: number, cidade: string): string {
  if (reais + exemplos === 0) return `Ainda não há imóveis em ${cidade}`;
  if (reais === 0) return `${exemplos} ${exemplos === 1 ? "anúncio" : "anúncios"} de exemplo em ${cidade}`;
  const reaisTxt = `${reais} ${reais === 1 ? "imóvel" : "imóveis"}`;
  if (exemplos === 0) return `${reaisTxt} em ${cidade}`;
  return `${reaisTxt} + ${exemplos} de exemplo em ${cidade}`;
}
