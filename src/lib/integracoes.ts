/**
 * Integrações pagas (Asaas, ZapSign, CAF): o "modo demonstração" (resultado
 * simulado quando falta a chave) SÓ existe fora de produção. Em produção, sem
 * a chave, a integração recusa com IntegracaoNaoConfigurada — a rota responde
 * 503 "Integração não configurada", nunca um "sucesso" simulado.
 *
 * Produção = VERCEL_ENV "production" (definida pela Vercel em tempo de execução).
 * Local e Preview seguem com a simulação.
 */
export class IntegracaoNaoConfigurada extends Error {
  constructor(public readonly servico: string) {
    super(`Integração não configurada: ${servico}`);
    this.name = "IntegracaoNaoConfigurada";
  }
}

export function emProducao(): boolean {
  return process.env.VERCEL_ENV === "production";
}

/** Chame no ramo "sem chave": em produção lança; fora dela, libera a simulação. */
export function exigirChaveEmProducao(servico: string): void {
  if (emProducao()) throw new IntegracaoNaoConfigurada(servico);
}

export const MSG_NAO_CONFIGURADA = "Integração não configurada.";
