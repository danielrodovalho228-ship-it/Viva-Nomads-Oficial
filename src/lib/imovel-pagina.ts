/**
 * Página do imóvel completa (ordem d943f893): lógica pura das abas de seção, dos
 * sinais de confiança do topo e do status de disponibilidade. Só dado REAL —
 * nada de "responde rápido" ou "calendário atualizado" sem fonte.
 */

export interface SecaoImovel {
  id: string;
  rotulo: string;
}

/** Abas âncora, na ordem de leitura da página (todas existem sempre: a de avaliações mostra o estado vazio). */
export function secoesDoImovel(p: { avaliacoes: number; temDono: boolean }): SecaoImovel[] {
  const s: SecaoImovel[] = [
    { id: "visao-geral", rotulo: "Visão geral" },
    { id: "comodidades", rotulo: "Comodidades" },
    { id: "disponibilidade", rotulo: "Disponibilidade" },
    // Prompt 41: o mapa aproximado vem antes das avaliações; o cartão do proprietário fecha a página.
    { id: "localizacao", rotulo: "Localização" },
    { id: "avaliacoes", rotulo: p.avaliacoes > 0 ? `Avaliações (${p.avaliacoes})` : "Avaliações" },
  ];
  if (p.temDono) s.push({ id: "proprietario", rotulo: "Proprietário" });
  return s;
}

const MESES = ["jan.", "fev.", "mar.", "abr.", "mai.", "jun.", "jul.", "ago.", "set.", "out.", "nov.", "dez."];

/** "Disponível agora" / "Disponível a partir de 12/11" — `hoje` em AAAA-MM-DD. */
export function statusDisponibilidade(availableFrom: string | undefined, hoje: string): string {
  const de = availableFrom?.slice(0, 10);
  if (!de || !/^\d{4}-\d{2}-\d{2}$/.test(de) || de <= hoje) return "Disponível agora";
  return `Disponível a partir de ${de.slice(8, 10)}/${de.slice(5, 7)}`;
}

/** Código curto e estável do anúncio, para citar no atendimento ("Código VN-3F9A2C"). */
export function codigoDoImovel(id: string): string {
  const limpo = id.replace(/[^a-zA-Z0-9]/g, "").slice(0, 6).toUpperCase();
  return `VN-${limpo}`;
}

export type SinalConfianca = { tipo: "disponibilidade" | "resposta" | "desde" | "codigo"; texto: string };

/** Lista curta do topo da página. Cada item só aparece com dado real. */
export function sinaisDeConfianca(
  p: { id: string; availableFrom?: string; owner?: { memberSince?: string; responseRate?: number } },
  hoje: string
): SinalConfianca[] {
  const s: SinalConfianca[] = [{ tipo: "disponibilidade", texto: statusDisponibilidade(p.availableFrom, hoje) }];
  const taxa = p.owner?.responseRate;
  if (taxa != null && Number.isFinite(taxa) && taxa > 0) s.push({ tipo: "resposta", texto: `Responde ${Math.round(taxa)}% das mensagens` });
  const desde = p.owner?.memberSince;
  if (desde && /^\d{4}-\d{2}/.test(desde)) {
    const m = Number(desde.slice(5, 7));
    s.push({ tipo: "desde", texto: `Anuncia aqui desde ${m >= 1 && m <= 12 ? MESES[m - 1] + " " : ""}${desde.slice(0, 4)}` });
  }
  s.push({ tipo: "codigo", texto: `Código ${codigoDoImovel(p.id)}` });
  return s;
}
