/*
  Tempo de deslocamento (Prompt 37) — PURO. Meios de transporte, arredondamento do que vai para a tela e os textos
  ("~15 min de carro até o HC-UFU", "≈ 3,2 km em linha reta"). Nunca inventa minuto: sem minutos, sem texto de tempo.
*/

export const MODOS = ["carro", "a_pe", "bicicleta", "onibus"] as const;
export type Modo = (typeof MODOS)[number];

/** Rótulo do botão de escolha do meio de transporte. */
export const ROTULO_MODO: Record<Modo, string> = {
  carro: "Carro",
  a_pe: "A pé",
  bicicleta: "Bicicleta",
  onibus: "Ônibus",
};

/** Complemento do texto: "de carro", "a pé"… */
const FRASE_MODO: Record<Modo, string> = {
  carro: "de carro",
  a_pe: "a pé",
  bicicleta: "de bicicleta",
  onibus: "de ônibus",
};

/** Filtro "até N min" da busca. */
export const OPCOES_ATE = [10, 15, 20, 30, 45] as const;

/** Validade do cache de tempos (dias). */
export const VALIDADE_CACHE_DIAS = 30;

export function ehModo(v: unknown): v is Modo {
  return typeof v === "string" && (MODOS as readonly string[]).includes(v);
}

/**
 * Minutos para a tela: para cima, em múltiplos de 5 (~15 min). Abaixo de 5 → 0 ("menos de 5 min").
 * null para valor inválido (o provedor não respondeu) — nunca um número inventado.
 */
export function arredondarMinutos(minutos: number | null | undefined): number | null {
  if (minutos == null || !Number.isFinite(minutos) || minutos < 0) return null;
  if (minutos < 5) return 0;
  return Math.ceil(minutos / 5) * 5;
}

/** "menos de 5 min" | "~15 min". Recebe minutos crus ou já arredondados (arredonda de novo, sem efeito). */
export function textoMinutos(minutos: number): string {
  const m = arredondarMinutos(minutos);
  if (m == null) return "";
  return m === 0 ? "menos de 5 min" : `~${m} min`;
}

/** Artigo do destino: "até o HC-UFU", "até a UFU"… Rótulos de endereço digitado vêm sem artigo ("até Rua X"). */
export function ateODestino(rotulo: string, artigo?: "o" | "a" | null): string {
  const r = rotulo.trim();
  if (!r) return "";
  return artigo ? `até ${artigo === "a" ? "a" : "o"} ${r}` : `até ${r}`;
}

/** Artigo provável de um destino cadastrado (pelo tipo e pelo começo do nome). */
export function artigoDoDestino(nome: string, tipo?: string | null): "o" | "a" {
  const n = nome.trim().toLowerCase();
  if (/^(ufu|universidade|faculdade|escola|clínica|clinica|santa|unidade|uni|policlínica|policlinica|empresa)\b/.test(n)) return "a";
  if (tipo === "universidade" && !/^(hc|hospital|campus|instituto|centro)\b/.test(n)) return "a";
  return "o";
}

/**
 * Texto do cartão: "~15 min de carro até o HC-UFU" / "menos de 5 min a pé até o HC-UFU".
 * Sem minutos válidos → "" (quem chama mostra a linha reta ou "calculando…").
 */
export function rotuloTempo(o: { minutos: number | null | undefined; modo: Modo; destinoRotulo?: string; artigo?: "o" | "a" | null }): string {
  const m = arredondarMinutos(o.minutos);
  if (m == null) return "";
  const base = `${m === 0 ? "menos de 5 min" : `~${m} min`} ${FRASE_MODO[o.modo]}`;
  const ate = o.destinoRotulo ? ateODestino(o.destinoRotulo, o.artigo) : "";
  return ate ? `${base} ${ate}` : base;
}

/** "≈ 3,2 km em linha reta" (uma casa, vírgula). Abaixo de 100 m: "≈ 0,1 km em linha reta". */
export function rotuloLinhaReta(km: number | null | undefined): string {
  if (km == null || !Number.isFinite(km) || km < 0) return "";
  const v = Math.max(0.1, Math.round(km * 10) / 10);
  return `≈ ${v.toFixed(1).replace(".", ",")} km em linha reta`;
}

/** Cabe no filtro "até N min"? Compara o MESMO número que a tela mostra (arredondado). */
export function dentroDoLimite(minutos: number | null | undefined, ate: number | null | undefined): boolean {
  if (!ate) return true;
  const m = arredondarMinutos(minutos);
  return m != null && m <= ate;
}

/**
 * Faixas de minutos (≤10, ≤20, ≤30, >30) — a regra que o Prompt 33 (ordenarBusca) usa no lugar das faixas de km
 * quando há destino. 0 é a melhor faixa; sem minutos, a pior.
 */
export function faixaMinutos(minutos: number | null | undefined): 0 | 1 | 2 | 3 | 4 {
  const m = arredondarMinutos(minutos);
  if (m == null) return 4;
  if (m <= 10) return 0;
  if (m <= 20) return 1;
  if (m <= 30) return 2;
  return 3;
}
