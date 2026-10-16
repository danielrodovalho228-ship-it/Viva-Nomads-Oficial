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
  const dif = atual - anterior;
  const dica =
    dif === 0
      ? "igual aos 30 dias anteriores"
      : `${Math.abs(dif)} a ${dif > 0 ? "mais" : "menos"} que nos 30 dias anteriores`;
  return { valor: String(atual), rotulo, dica, href: "/dashboard/leads" };
}
