/*
  Sugestões automáticas do cadastro (prompt 10). PURO. Tudo aqui é SUGESTÃO: aparece com "Sugerido · confira" e
  nada vai ao anúncio sem o proprietário confirmar.
*/

/** Marca dos campos preenchidos pela IA ou por estimativa. */
export const MARCA_SUGERIDO = "Sugerido · confira";

/** Capacidade sugerida: 2 pessoas por quarto (studio/0 quarto = 2). Editável. */
export function capacidadeSugerida(quartos: number | null | undefined): number {
  const q = Math.max(0, Math.floor(Number(quartos) || 0));
  return Math.max(2, q * 2);
}

/*
  Estimativa de consumo (água, luz e gás) por mês, por número de quartos — regra simples, editável pelo dono:
  base de R$ 150 (studio/1 quarto) + R$ 70 por quarto a partir do segundo, arredondado para a dezena.
  É uma estimativa de partida, não um preço: o proprietário ajusta pelas próprias contas.
*/
export const CONSUMO_BASE = 150;
export const CONSUMO_POR_QUARTO_EXTRA = 70;

export function consumoSugerido(quartos: number | null | undefined): number {
  const q = Math.max(1, Math.floor(Number(quartos) || 0));
  return Math.round((CONSUMO_BASE + (q - 1) * CONSUMO_POR_QUARTO_EXTRA) / 10) * 10;
}

/*
  "Pronto para trabalhar de casa": os 4 essenciais são os MESMOS critérios da etiqueta "Para trabalhar de casa"
  (src/lib/qualification.ts → homeOfficeItems: cômodo/escritório, mesa, cadeira e internet que aguenta trabalho).
  Não é uma regra paralela: a etiqueta continua sendo dada pela qualificação. "Ambiente silencioso", iluminação e
  tomadas são opcionais (decisão do Daniel, 17/10) e não contam para a etiqueta.
*/
export const ESSENCIAIS_TRABALHO = [
  { chave: "home_office", rotulo: "Cômodo ou canto de trabalho" },
  { chave: "internet_fibra", rotulo: "Internet fibra" },
  { chave: "mesa_trabalho", rotulo: "Mesa de trabalho" },
  { chave: "cadeira_ergonomica", rotulo: "Cadeira ergonômica" },
] as const;

export const OPCIONAIS_TRABALHO = [
  { chave: "ambiente_silencioso", rotulo: "Ambiente silencioso" },
  { chave: "iluminacao_boa", rotulo: "Boa iluminação" },
  { chave: "tomadas_mesa", rotulo: "Tomadas perto da mesa" },
] as const;

export function essenciaisMarcados(marcadas: Record<string, boolean>): number {
  return ESSENCIAIS_TRABALHO.filter((e) => marcadas[e.chave]).length;
}

export function contadorEssenciais(marcadas: Record<string, boolean>): string {
  return `${essenciaisMarcados(marcadas)} de ${ESSENCIAIS_TRABALHO.length} itens essenciais`;
}

/** Velocidade informada (Mbps), opcional: 1 a 10.000; vazio/lixo = null. */
export function mbpsValido(v: unknown): number | null {
  const n = Math.round(Number(String(v ?? "").replace(/\D/g, "")));
  return Number.isFinite(n) && n >= 1 && n <= 10_000 ? n : null;
}

/*
  Preço sugerido para imóveis parecidos na região (prompt 10, etapa 4): MEDIANA do valor mensal de anúncios ATIVOS
  e reais da plataforma — mesma cidade e mesmo número de quartos, de preferência no mesmo bairro. Sem pelo menos
  MIN_COMPARAVEIS anúncios, não há sugestão (nunca um número inventado). Arredondado para R$ 50.
*/
export const MIN_COMPARAVEIS = 3;

export function medianaSugerida(valores: readonly number[], min = MIN_COMPARAVEIS): number | null {
  const v = valores.filter((x) => Number.isFinite(x) && x > 0).sort((a, b) => a - b);
  if (v.length < min) return null;
  const meio = Math.floor(v.length / 2);
  const mediana = v.length % 2 ? v[meio] : (v[meio - 1] + v[meio]) / 2;
  return Math.round(mediana / 50) * 50;
}

/** Bairro primeiro (com comparáveis suficientes); senão a cidade; senão nada. */
export function sugestaoDaRegiao(doBairro: readonly number[], daCidade: readonly number[]): { valor: number; base: "bairro" | "cidade"; n: number } | null {
  const b = medianaSugerida(doBairro);
  if (b !== null) return { valor: b, base: "bairro", n: doBairro.length };
  const c = medianaSugerida(daCidade);
  if (c !== null) return { valor: c, base: "cidade", n: daCidade.length };
  return null;
}
