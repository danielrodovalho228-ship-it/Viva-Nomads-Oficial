/*
  KPI "Interessados" da Visão geral do proprietário (ordem de8761b0, item 3):
  período e comparação explícitos e, quando zero, a próxima ação — nunca só "0".
  Puro (sem acesso a banco): quem chama entrega as datas de criação dos leads.
*/

const DIA_MS = 24 * 60 * 60 * 1000;

export interface KpiInteressados {
  valor: string;
  rotulo: string;
  dica: string;
  href: string;
}

/** Conta candidaturas dos últimos 30 dias e dos 30 dias anteriores a esses. */
export function contarInteressados(
  datas: ReadonlyArray<string | null | undefined>,
  agora: Date = new Date(),
): { atual: number; anterior: number } {
  let atual = 0;
  let anterior = 0;
  for (const d of datas) {
    if (!d) continue;
    const t = Date.parse(d);
    if (Number.isNaN(t)) continue;
    const idade = agora.getTime() - t;
    if (idade < 0) continue;
    if (idade < 30 * DIA_MS) atual += 1;
    else if (idade < 60 * DIA_MS) anterior += 1;
  }
  return { atual, anterior };
}

export function kpiInteressados(
  atual: number,
  anterior: number,
  { temImovelPublicado }: { temImovelPublicado: boolean },
): KpiInteressados {
  const rotulo = "Interessados · últimos 30 dias";
  if (atual === 0) {
    return temImovelPublicado
      ? { valor: "0", rotulo, dica: "Compartilhe seu anúncio para receber candidaturas.", href: "/dashboard/imoveis" }
      : { valor: "0", rotulo, dica: "Publique seu primeiro anúncio para receber candidaturas.", href: "/dashboard/imoveis/novo" };
  }
  return { valor: String(atual), rotulo, dica: comparacao(atual, anterior), href: "/dashboard/leads" };
}

const fmt = (n: number) => n.toLocaleString("pt-BR");

/** "3 a mais que nos 30 dias anteriores" — a mesma frase em todos os KPIs da Visão geral. */
function comparacao(atual: number, anterior: number): string {
  const dif = atual - anterior;
  return dif === 0
    ? "igual aos 30 dias anteriores"
    : `${fmt(Math.abs(dif))} a ${dif > 0 ? "mais" : "menos"} que nos 30 dias anteriores`;
}

/**
 * KPI "Visualizações" (ordem de8761b0, item 3): período, comparação e, quando zero, a próxima ação.
 * `null` = não foi possível ler: mostra "—" e não inventa zero nem ação.
 */
export function kpiVisualizacoes(v: { atual: number; anterior: number } | null): KpiInteressados {
  const rotulo = "Visualizações · últimos 30 dias";
  if (!v) return { valor: "—", rotulo, dica: "Não foi possível ler agora.", href: "/dashboard/imoveis" };
  if (v.atual === 0) {
    return { valor: "0", rotulo, dica: "Compartilhe seu anúncio para ser visto.", href: "/dashboard/imoveis" };
  }
  return { valor: fmt(v.atual), rotulo, dica: comparacao(v.atual, v.anterior), href: "/dashboard/imoveis" };
}

/** KPI "Mensagens" (ordem de8761b0, item 3): nunca só "0" — diz o que fazer quando a primeira chegar. */
export function kpiMensagens(total: number | null): KpiInteressados {
  const rotulo = "Mensagens";
  const href = "/dashboard/mensagens";
  if (total == null) return { valor: "—", rotulo, dica: "Não foi possível ler agora.", href };
  if (total === 0) return { valor: "0", rotulo, dica: "Quando um interessado escrever, responda rápido.", href };
  return { valor: fmt(total), rotulo, dica: total === 1 ? "1 conversa com interessados" : `${fmt(total)} conversas com interessados`, href };
}
