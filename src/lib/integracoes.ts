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
  readonly servico: string;
  constructor(servico: string) {
    super(`Integração não configurada: ${servico}`);
    this.servico = servico;
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

/**
 * LABORATÓRIO DE TESTES: com INTEGRACOES_SIMULADAS=on, TODAS as integrações
 * (e-mail, WhatsApp, Asaas, ZapSign, CAF, IA) ficam como "sem chave" mesmo que
 * alguma chave exista — nada sai para a rede — e cada envio que "teria
 * acontecido" vira uma linha JSON em LAB_OUTBOX, para os testes conferirem.
 * NUNCA vale em produção (VERCEL_ENV=production): lá é ignorado, e o
 * next.config recusa o build com a chave ligada.
 */
export function integracoesSimuladas(): boolean {
  return process.env.INTEGRACOES_SIMULADAS === "on" && !emProducao();
}

/** Registra no LAB_OUTBOX (JSONL) o que teria sido enviado. Sem LAB_OUTBOX, não faz nada. */
export async function registrarSimulado(servico: string, dados: Record<string, unknown>): Promise<void> {
  const arquivo = process.env.LAB_OUTBOX;
  if (!integracoesSimuladas() || !arquivo) return;
  const { appendFile } = await import("node:fs/promises");
  await appendFile(arquivo, JSON.stringify({ servico, em: new Date().toISOString(), ...dados }) + "\n", "utf8").catch(() => undefined);
}
