/*
  E1079 — Central → Avaliadores pelos mockups aprovados (admin-avaliadores-novo): o que cada cartão mostra.
  Só texto e estado; as cores e medidas do desenho ficam em ../conta/visual-mockup.ts. Nomes, valores e contagens vêm
  sempre do sistema — o desenho traz exemplos.
*/
import { MIN_AVALIADORES_ATIVOS, PORTES, precoVigente, type CondicaoChave, type LinhaPreco, type Porte, type StatusCredenciamento } from "./regras.ts";

export type TomPilula = "ok" | "atencao" | "pendente" | "teste";

export const TITULO_CHAVE = "Chave da Vistoria";
export const TEXTO_REGRA_CHAVE = "A chave é liberada apenas quando todos os itens forem cumpridos.";

/** A linha de uma condição da chave: rótulo curto do desenho e a pílula (com quanto falta, quando dá para dizer). */
export function cartaoDaCondicao(c: CondicaoChave, avaliadoresAtivos: number): { rotulo: string; pilula: string; tom: TomPilula } {
  const rotulo = c.id === "tabela" ? "Tabela de preço preenchida" : c.id === "avaliadores" ? `${MIN_AVALIADORES_ATIVOS} avaliadores ativos na cidade` : "Parecer jurídico";
  if (c.ok) return { rotulo, pilula: "Cumprida", tom: "ok" };
  if (c.id === "parecer") return { rotulo, pilula: "Pendente", tom: "pendente" };
  if (c.id === "avaliadores") return { rotulo, pilula: `Falta ${Math.max(1, MIN_AVALIADORES_ATIVOS - Math.max(0, avaliadoresAtivos))}`, tom: "atencao" };
  return { rotulo, pilula: "Falta", tom: "atencao" };
}

/** Cor da pílula do credenciado: ativo em verde, em teste em ocre, o resto neutro. */
export function tomDoStatus(s: StatusCredenciamento): TomPilula {
  return s === "ativo" ? "ok" : s === "em_teste" ? "teste" : "pendente";
}

export const linhaDoCredenciado = (c: { numero: string; cidade: string }) => `${c.numero} • ${c.cidade}`;

export const ROTULO_PORTE_CURTO: Record<Porte, string> = { estudio: "Estúdio", q1_2: "1–2 quartos", q3_mais: "3+ quartos" };

/** "R$ 150" quando o valor é redondo (como no desenho); com centavos quando tem; travessão quando não há valor. */
export function valorDaTabela(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return "—";
  const inteiro = Number.isInteger(v);
  return `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: inteiro ? 0 : 2, maximumFractionDigits: inteiro ? 0 : 2 })}`;
}

/**
 * A tabela limpa: por cidade, os 3 portes com o valor vigente — a mesma regra da casa (precoVigente: a linha mais
 * recente já em vigor), a que decide a condição "tabela preenchida" da chave.
 */
export function tabelaLimpaPorCidade(tabela: LinhaPreco[], cidades: string[], agora: Date): { cidade: string; linhas: { porte: Porte; rotulo: string; valor: string }[] }[] {
  return cidades.map((cidade) => ({
    cidade,
    linhas: PORTES.map((porte) => ({ porte, rotulo: ROTULO_PORTE_CURTO[porte], valor: valorDaTabela(precoVigente(tabela, cidade, porte, agora)?.valor ?? null) })),
  }));
}

/** Subtítulo do desenho ("…da cidade de Uberlândia"); com várias cidades ou nenhuma, não inventa uma. */
export function subtituloDaCentral(cidades: string[]): string {
  const base = "Gerencie os avaliadores e a chave da vistoria";
  return cidades.length === 1 ? `${base} da cidade de ${cidades[0]}` : cidades.length > 1 ? `${base} de cada cidade` : base;
}
