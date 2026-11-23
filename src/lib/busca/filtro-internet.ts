/*
  Prompt 57, fase 2 — filtro de internet MEDIDA na busca (PURO). Uma regra só para a lista, a contagem "Mostrar N
  imóveis", o alerta de busca e o link do pedido de moradia.

  - "Internet medida a partir de" (chips de download em Mbps) e/ou "só com internet medida": passa só imóvel com medição
    válida do dono (fase 1) que alcança o valor escolhido.
  - Nenhum imóvel some por não ter testado: quem não tem medição válida, mas tem internet INFORMADA pelo dono (no valor
    escolhido, quando há valor), entra na linha "Mais N imóveis com internet informada, mas não medida" — com o rótulo
    "não medida". Medição válida abaixo do valor não volta pela porta do informado: a medição vale mais que o informado.
  - Filtro desligado: a busca não muda.
*/
import { INTERNET } from "../../config/internet.ts";

export type ChipInternet = (typeof INTERNET.chipsBusca)[number];
export const CHIPS_INTERNET: readonly ChipInternet[] = INTERNET.chipsBusca;

export interface FiltroInternet {
  /** Download mínimo medido (Mbps); 0 = sem valor. */
  internetMin: number;
  /** "Só com internet medida" (dentro de "Para trabalhar de casa"). */
  soInternetMedida: boolean;
}

export interface ImovelComInternet {
  internetMbps?: number;
  internetMedida?: { downloadMbps: number; validoAte: string };
}

export const filtroInternetLigado = (f: FiltroInternet) => f.internetMin > 0 || f.soInternetMedida;

/** Download da medição válida do dono (null sem medição ou com ela vencida). */
export function downloadMedido(p: ImovelComInternet, agora: Date): number | null {
  const m = p.internetMedida;
  if (!m || !(new Date(m.validoAte).getTime() > agora.getTime())) return null;
  return Number.isFinite(m.downloadMbps) ? m.downloadMbps : null;
}

/**
 * E1078 (ORDEM-DUET-382, opção (a)): a VELOCIDADE do imóvel — a medida quando há medição válida; sem ela, a informada
 * pelo dono (marcada "não medida"); sem nenhuma das duas, null (velocidade desconhecida).
 */
export function velocidadeDoImovel(p: ImovelComInternet, agora: Date): { mbps: number; medida: boolean } | null {
  const d = downloadMedido(p, agora);
  if (d !== null) return { mbps: d, medida: true };
  const informada = Number(p.internetMbps ?? 0);
  return Number.isFinite(informada) && informada > 0 ? { mbps: informada, medida: false } : null;
}

/**
 * Passa no filtro de velocidade? Desligado → sempre passa. "Só com internet medida" (estrito) → só a medição válida.
 * Sem o estrito: a velocidade do imóvel (medida, ou a informada sem medição) alcança o valor escolhido. A medição válida
 * abaixo do valor não volta pela porta do informado: a medição vale mais que o informado.
 */
export function passaInternet(p: ImovelComInternet, f: FiltroInternet, agora: Date): boolean {
  if (!filtroInternetLigado(f)) return true;
  if (f.soInternetMedida) {
    const d = downloadMedido(p, agora);
    return d !== null && d >= f.internetMin;
  }
  const v = velocidadeDoImovel(p, agora);
  return v !== null && v.mbps >= f.internetMin;
}

/**
 * Entra em "Mais N imóveis com internet informada, mas não medida"? Só com o estrito "Só com internet medida" ligado
 * (E1078: sem o estrito, o informado já passa na lista, com o rótulo "não medida" no cartão).
 */
export function informadaNaoMedida(p: ImovelComInternet, f: FiltroInternet, agora: Date): boolean {
  if (!f.soInternetMedida || downloadMedido(p, agora) !== null) return false;
  const informada = p.internetMbps ?? 0;
  return informada > 0 && informada >= f.internetMin;
}

/** E1078: fica de fora por não ter velocidade nenhuma (nem medida nem informada)? Só com o filtro ligado. */
export function velocidadeDesconhecida(p: ImovelComInternet, f: FiltroInternet, agora: Date): boolean {
  return filtroInternetLigado(f) && velocidadeDoImovel(p, agora) === null;
}

/** E1078: a linha dos desconhecidos no fim da lista. */
export function textoVelocidadeDesconhecida(n: number): string {
  return `Velocidade desconhecida: ${n} ${n === 1 ? "imóvel" : "imóveis"}`;
}

/** Linha do fim da lista. */
export function textoMaisNaoMedidos(n: number): string {
  return n === 1 ? "Mais 1 imóvel com internet informada, mas não medida" : `Mais ${n} imóveis com internet informada, mas não medida`;
}

/** Botão da folha quando só sobram os de internet não medida (a lista medida ficou vazia). */
export function rotuloVerNaoMedidos(n: number): string {
  return `Ver ${n} com internet não medida`;
}

export const ROTULO_NAO_MEDIDA = "Internet informada pelo proprietário (não medida)";

/** Resumo/chip ativo: "Velocidade 100+ Mbps"; com o estrito, "Internet medida 100+ Mbps" ou "Internet medida". */
export function rotuloFiltroInternet(f: FiltroInternet): string | null {
  if (f.internetMin > 0) return f.soInternetMedida ? `Internet medida ${f.internetMin}+ Mbps` : `Velocidade ${f.internetMin}+ Mbps`;
  return f.soInternetMedida ? "Internet medida" : null;
}

// ── URL (a /buscar, o alerta de busca e o link do pedido usam as mesmas chaves) ────────────────────────────────
export function filtroInternetDaUrl(sp: URLSearchParams): FiltroInternet {
  const v = Number(sp.get("internet"));
  return { internetMin: (CHIPS_INTERNET as readonly number[]).includes(v) ? v : 0, soInternetMedida: sp.get("medida") === "1" };
}

export function filtroInternetNaUrl(params: URLSearchParams, f: FiltroInternet): void {
  if (f.internetMin > 0) params.set("internet", String(f.internetMin));
  else params.delete("internet");
  if (f.soInternetMedida) params.set("medida", "1");
  else params.delete("medida");
}
