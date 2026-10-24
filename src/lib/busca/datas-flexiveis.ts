/*
  Prompt 55, parte B2 — datas flexíveis na busca (PURO). Uma regra só para a lista, a contagem "Mostrar N imóveis" e o
  alerta de busca.

  - Sem flexibilidade (como hoje): com data de entrada, passa quem está disponível até essa data (ou sem data cadastrada).
  - Com "Datas flexíveis": passa também quem fica disponível até FOLGA_DATAS_FLEXIVEIS_DIAS depois da entrada.
  - Sem data de entrada, a flexibilidade não muda nada.

  A folga é a mesma que o Pedido de Moradia já usa para o "quase" da data de entrada (compatibilidade_pedidos, q6:
  disponível até 15 dias depois). Valor pendente de confirmação no desenho do Prompt 55 — mudar só aqui.
*/
export const FOLGA_DATAS_FLEXIVEIS_DIAS = 15;

export const ROTULO_DATAS_FLEXIVEIS = `Datas flexíveis (até ${FOLGA_DATAS_FLEXIVEIS_DIAS} dias depois)`;

const DATA = /^\d{4}-\d{2}-\d{2}$/;

/** yyyy-mm-dd + n dias (UTC, sem fuso: só a data). */
export function somarDias(data: string, n: number): string {
  const d = new Date(`${data}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Último dia em que o imóvel pode ficar disponível para entrar nesta busca. */
export function limiteDisponivel(entrada: string, flexivel: boolean): string {
  return flexivel ? somarDias(entrada, FOLGA_DATAS_FLEXIVEIS_DIAS) : entrada;
}

/** O imóvel atende a data de entrada? Sem entrada ou sem disponibilidade cadastrada, passa (como hoje). */
export function passaEntrada(availableFrom: string | null | undefined, entrada: string, flexivel: boolean): boolean {
  if (!entrada || !DATA.test(entrada) || !availableFrom) return true;
  return availableFrom.slice(0, 10) <= limiteDisponivel(entrada, flexivel);
}

// ── URL (a /buscar e o alerta de busca usam a mesma chave) ──────────────────────────────────────────────────────
export const datasFlexiveisDaUrl = (sp: URLSearchParams): boolean => sp.get("flex") === "1";

/**
 * Prompt 53: as datas bloqueadas (do dono ou importadas do Airbnb/Booking) tiram o imóvel da busca nessa entrada. A
 * estadia buscada começa na entrada e dura a faixa escolhida (ou 30 dias, o mínimo da Viva). Com "Datas flexíveis",
 * passa se ALGUMA entrada até FOLGA_DATAS_FLEXIVEIS_DIAS depois couber sem bloqueio. Sem entrada, não tira ninguém.
 */
export function passaBloqueios(
  bloqueios: readonly { inicio: string; fim: string }[] | null | undefined,
  entrada: string,
  flexivel: boolean,
  estadiaDias = 30,
): boolean {
  if (!entrada || !DATA.test(entrada) || !bloqueios?.length) return true;
  const dias = Math.max(30, estadiaDias || 30);
  const ultimaEntrada = flexivel ? FOLGA_DATAS_FLEXIVEIS_DIAS : 0;
  for (let d = 0; d <= ultimaEntrada; d++) {
    const ini = somarDias(entrada, d);
    const fim = somarDias(ini, dias - 1);
    if (!bloqueios.some((b) => b.inicio <= fim && ini <= b.fim)) return true;
  }
  return false;
}
