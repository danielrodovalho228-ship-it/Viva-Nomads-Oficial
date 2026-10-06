/*
  Piloto FUNDADOR — regras PURAS (sem imports, testável com node --test).
  Promessa pública (/precos): os 20 primeiros proprietários têm a assinatura
  GRATUITA por 12 meses com os recursos do Profissional (comissão do Profissional, config/planos) e,
  quando a cobrança começar, 20% de desconto vitalício.
  O limite de 20 vagas é garantido pelo banco (0063).
*/

export const FUNDADOR_VAGAS = 20;
export const FUNDADOR_MESES_GRATIS = 12;
export const FUNDADOR_DESCONTO = 0.2;

/** Fim dos 12 meses grátis (ISO), ou null se não é fundador. */
export function fimGratisFundador(fundador: boolean | null | undefined, fundadorEm: string | null | undefined): string | null {
  if (!fundador || !fundadorEm) return null;
  const d = new Date(fundadorEm);
  if (Number.isNaN(d.getTime())) return null;
  d.setUTCMonth(d.getUTCMonth() + FUNDADOR_MESES_GRATIS);
  return d.toISOString();
}

/** Está nos 12 meses grátis do Profissional? */
export function fundadorNoGratis(
  fundador: boolean | null | undefined,
  fundadorEm: string | null | undefined,
  agora: Date = new Date()
): boolean {
  const fim = fimGratisFundador(fundador, fundadorEm);
  return !!fim && agora.getTime() < new Date(fim).getTime();
}

/**
 * Plano que vale para o proprietário: a assinatura ATIVA, se houver (pagou →
 * vale o que pagou); senão, Profissional enquanto Fundador no período grátis;
 * senão, Gratuito.
 */
export function planoEfetivo(
  planoAssinaturaAtiva: string | null | undefined,
  fundador: boolean | null | undefined,
  fundadorEm: string | null | undefined,
  agora: Date = new Date()
): string {
  if (planoAssinaturaAtiva && planoAssinaturaAtiva !== "free") return planoAssinaturaAtiva;
  if (fundadorNoGratis(fundador, fundadorEm, agora)) return "pro";
  return "free";
}

/** Preço da assinatura com o desconto vitalício do Fundador (centavos arredondados). */
export function precoComDescontoFundador(preco: number, fundador: boolean | null | undefined): number {
  if (!fundador) return preco;
  return Math.round(preco * (1 - FUNDADOR_DESCONTO) * 100) / 100;
}
