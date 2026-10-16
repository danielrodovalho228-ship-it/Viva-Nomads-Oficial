/*
  Automações de e-mail por data (ordem d250ea2f, item 5) — regras PURAS, sem servidor.
  O cron diário (/api/cron/automacoes) só liga estas regras ao banco. Cada aviso sai UMA vez por
  pessoa (chave em automacoes_envios) e respeita "parar de receber" (profiles.notif_email = false).
  Roda: node --test src/lib/automacoes/regras.test.ts
*/

export type TipoAutomacao = "anuncio_incompleto" | "saida_lembrete" | "avaliacao_pedido" | "renovacao_aviso";

const DIA_MS = 86_400_000;

function soData(iso: string): string {
  return (iso ?? "").slice(0, 10);
}

/** Dias inteiros de `de` até `ate` (datas AAAA-MM-DD; positivo = `ate` é depois). */
export function diasEntre(de: string, ate: string): number {
  return Math.round((Date.parse(soData(ate)) - Date.parse(soData(de))) / DIA_MS);
}

/** Data em Brasília (UTC-3) de um instante. */
export function dataEmBrasilia(instante: Date | string): string {
  const t = typeof instante === "string" ? Date.parse(instante) : instante.getTime();
  return new Date(t - 3 * 3600_000).toISOString().slice(0, 10);
}

/** Rascunho de imóvel parado: avisa com 1 dia (≈24 h) e com 3 dias. Outro dia: nada. */
export function avisoAnuncioIncompleto(criadoEm: string, hoje: string): 1 | 3 | null {
  const dias = diasEntre(dataEmBrasilia(criadoEm), hoje);
  return dias === 1 || dias === 3 ? dias : null;
}

/** Faltam exatamente 3 dias para a saída. */
export function lembreteDeSaida(fim: string, hoje: string): boolean {
  return diasEntre(hoje, fim) === 3;
}

/** A saída foi ontem: hora de pedir a avaliação. */
export function pedirAvaliacao(fim: string, hoje: string): boolean {
  return diasEntre(fim, hoje) === 1;
}

/** Faltam exatamente 15 dias para o fim do bloco: "quer renovar?". */
export function avisarRenovacao(fim: string, hoje: string): boolean {
  return diasEntre(hoje, fim) === 15;
}

/** Chave única do envio (uma por aviso e pessoa). */
export function chaveEnvio(tipo: TipoAutomacao, referenciaId: string, usuarioId: string, variante = ""): string {
  return [tipo, referenciaId, usuarioId, variante].filter(Boolean).join(":");
}

/** Quem recebe: precisa de e-mail e de não ter desligado os avisos. */
export function podeReceber(perfil: { email?: string | null; notif_email?: boolean | null } | null | undefined): boolean {
  return !!perfil?.email && perfil.notif_email !== false;
}

function dataBr(iso: string): string {
  const [a, m, d] = soData(iso).split("-");
  return `${d}/${m}/${a}`;
}

/** Linha de detalhe (texto puro) do e-mail/WhatsApp: só datas e nome do imóvel, nada pessoal. */
export function detalheAutomacao(tipo: TipoAutomacao, ctx: { imovel?: string; fim?: string; dias?: 1 | 3 }): string {
  const imovel = ctx.imovel ? `Imóvel: ${ctx.imovel}.` : "";
  switch (tipo) {
    case "anuncio_incompleto":
      return `${imovel} ${ctx.dias === 3 ? "Seu cadastro está parado há 3 dias." : "Seu cadastro está parado desde ontem."} Termine para enviar a documentação e publicar.`.trim();
    case "saida_lembrete":
      return `${imovel} Saída em ${ctx.fim ? dataBr(ctx.fim) : "3 dias"}. Combine a conferência de saída pela plataforma.`.trim();
    case "avaliacao_pedido":
      return `${imovel} A estadia terminou em ${ctx.fim ? dataBr(ctx.fim) : "ontem"}. Sua avaliação leva 2 minutos e ajuda os próximos moradores.`.trim();
    case "renovacao_aviso":
      return `${imovel} O bloco termina em ${ctx.fim ? dataBr(ctx.fim) : "15 dias"}. Quer renovar? Combine pela plataforma.`.trim();
  }
}

/**
 * Trava do cron: sem `AUTOMACOES_ATIVO=1` no ambiente o cron só SIMULA (conta, não envia nem marca nada).
 * O Daniel liga o envio real depois de ver a contagem simulada. `?simular=1` sempre força a simulação.
 */
export function modoSimulado(paramSimular: string | null, automacoesAtivo: string | undefined): boolean {
  return paramSimular === "1" || automacoesAtivo !== "1";
}
