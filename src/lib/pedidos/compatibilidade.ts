/*
  Compatibilidade Pedido de Moradia × imóvel — TEXTOS e AGRUPAMENTOS puros.
  A REGRA mora no banco (compatibilidade_pedidos, 0064): aqui só se explica
  "por que combina", escolhe o melhor imóvel de cada dono e monta a sugestão
  ao inquilino. Sem imports (testável com node --test).
*/

export type Situacao = "compativel" | "quase" | "demais";

/** Uma linha de compatibilidade_pedidos (pedido, imóvel). */
export interface ParCompat {
  pedido_id: string;
  imovel_id: string;
  dono_id: string;
  titulo: string;
  situacao: Situacao;
  nota: number;
  motivo: string | null;
  total_mensal: number;
  orcamento: number;
  vagas: number | null;
  ocupantes: number;
  prazo_dias: number;
  min_dias: number;
  max_dias: number;
  entrada: string;
  disponivel_desde: string | null;
}

/** Limite de e-mails de pedido por dono por dia; o resto vai no resumo diário. */
export const EMAILS_PEDIDO_POR_DIA = 5;

const ORDEM: Record<Situacao, number> = { compativel: 0, quase: 1, demais: 2 };

function brl(v: number): string {
  return `R$ ${Math.round(v)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ".")}`;
}
function dataCurta(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? `${m[3]}/${m[2]}` : iso;
}

/** Ordena: compatível > quase > demais; depois maior nota. */
export function ordenarPares<T extends Pick<ParCompat, "situacao" | "nota">>(pares: T[]): T[] {
  return [...pares].sort((a, b) => ORDEM[a.situacao] - ORDEM[b.situacao] || b.nota - a.nota);
}

/** Melhor par de cada chave (dono ou pedido), já ordenado. */
export function melhorPor<T extends ParCompat>(pares: T[], chave: "dono_id" | "pedido_id"): Map<string, T> {
  const mapa = new Map<string, T>();
  for (const p of ordenarPares(pares)) if (!mapa.has(p[chave])) mapa.set(p[chave], p);
  return mapa;
}

/** Por que o imóvel combina com o pedido (frases curtas, sem dado pessoal). */
export function porQueCombina(p: ParCompat): string[] {
  const motivos = [
    `${brl(p.total_mensal)}/mês com condomínio e consumo, para um orçamento de ${brl(p.orcamento)}`,
    `${p.vagas} vaga${p.vagas === 1 ? "" : "s"} para ${p.ocupantes} pessoa${p.ocupantes === 1 ? "" : "s"}`,
    `aceita ${p.prazo_dias} dias (o anúncio aceita de ${p.min_dias} a ${p.max_dias})`,
  ];
  motivos.push(
    p.disponivel_desde && p.disponivel_desde < p.entrada
      ? `livre desde ${dataCurta(p.disponivel_desde)}, antes da entrada em ${dataCurta(p.entrada)}`
      : `livre na entrada em ${dataCurta(p.entrada)}`
  );
  return motivos;
}

/**
 * Sugestão ao inquilino quando nenhum imóvel combina: usa o "quase" mais
 * frequente (preço, prazo ou data). null se não há nada perto.
 */
export function sugestaoAjuste(pares: Pick<ParCompat, "situacao" | "motivo">[]): string | null {
  const quase = pares.filter((p) => p.situacao === "quase" && p.motivo);
  if (quase.length === 0) return null;
  const preco = quase.filter((p) => /orçamento/.test(p.motivo!)).length;
  const data = quase.filter((p) => /começa/.test(p.motivo!)).length;
  const prazo = quase.length - preco - data;
  const n = quase.length;
  const plural = n === 1 ? "1 imóvel quase combina" : `${n} imóveis quase combinam`;
  if (preco >= data && preco >= prazo) return `${plural} — aumentar um pouco o orçamento pode resolver (${quase.find((p) => /orçamento/.test(p.motivo!))!.motivo}).`;
  if (data >= prazo) return `${plural} — adiar a entrada em alguns dias pode resolver (${quase.find((p) => /começa/.test(p.motivo!))!.motivo}).`;
  return `${plural} — ajustar o prazo pode resolver (${quase.find((p) => /prazo/.test(p.motivo!))!.motivo}).`;
}
