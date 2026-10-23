/*
  Adendo 59.1, item 6 — CENTRAL DE PENDÊNCIAS do admin (PURO). Uma fila só, com filtros, que amplia o topo de decisões
  do Prompt 46: a contagem de cada filtro é a MESMA que o topo mostra (uma fonte de números). As filas do 59-A
  (manutenção fora do prazo e contestações do padrão mínimo) viram filtros daqui.
  Cada linha: idade, prazo, gravidade e a ação em um toque. Contas de teste ficam à parte (não entram nas contagens).
*/

export const FILTROS_CENTRAL = [
  { chave: "conforto_contestacoes", rotulo: "Contestações para decidir", lado: "equipe" },
  { chave: "manutencao_fora_prazo", rotulo: "Manutenção fora do prazo", lado: "equipe" },
  { chave: "fotos_nivel", rotulo: "Fotos de nível para analisar", lado: "equipe" },
  { chave: "documentos_pendentes", rotulo: "Documentos para conferir", lado: "equipe" },
  { chave: "conforto_abertas", rotulo: "\"Não confere\" abertos", lado: "proprietario" },
  { chave: "adequacoes", rotulo: "Adequações vencendo ou vencidas", lado: "proprietario" },
  { chave: "confirmacoes_48h", rotulo: "Confirmações de 48 h do morador", lado: "morador" },
] as const;

export type FiltroCentral = (typeof FILTROS_CENTRAL)[number]["chave"];
export const ehFiltroCentral = (v: unknown): v is FiltroCentral => typeof v === "string" && FILTROS_CENTRAL.some((f) => f.chave === v);

export type Gravidade = "alta" | "media" | "baixa";
const PESO_GRAVIDADE: Record<Gravidade, number> = { alta: 0, media: 1, baixa: 2 };

export interface LinhaCentral {
  filtro: FiltroCentral;
  id: string;
  titulo: string;
  detalhe: string | null;
  /** Desde quando está na fila (ISO). */
  desde: string;
  /** Prazo da próxima ação (ISO) ou null. */
  prazoAte: string | null;
  gravidade: Gravidade;
  acao: { rotulo: string; href: string };
  /** Conta de teste: aparece à parte e não entra nas contagens. */
  teste: boolean;
  /** Dados para ações em um toque na própria linha (ex.: aceitar/recusar foto, decidir contestação). */
  ref?: Record<string, string>;
  /** Linha que resume uma fila de outra tela (ex.: documentos): quantos itens ela representa. Padrão 1. */
  quantidade?: number;
}

export interface Central {
  /** Contagem por filtro, sem contas de teste (a mesma do topo de decisões). */
  contagens: Record<FiltroCentral, number>;
  total: number;
  linhas: LinhaCentral[];
  teste: LinhaCentral[];
}

export const idadeHoras = (desde: string, agora: Date): number => Math.max(0, (agora.getTime() - new Date(desde).getTime()) / 3_600_000);

/** Monta a Central: separa as contas de teste, conta por filtro e ordena por gravidade, prazo e idade. */
export function montarCentral(linhas: readonly LinhaCentral[], agora: Date, filtro?: FiltroCentral | null): Central {
  const contagens = Object.fromEntries(FILTROS_CENTRAL.map((f) => [f.chave, 0])) as Record<FiltroCentral, number>;
  const reais: LinhaCentral[] = [];
  const teste: LinhaCentral[] = [];
  for (const l of linhas) {
    if (l.teste) teste.push(l);
    else {
      reais.push(l);
      contagens[l.filtro] += Math.max(0, Math.floor(l.quantidade ?? 1));
    }
  }
  const ordem = (a: LinhaCentral, b: LinhaCentral) =>
    PESO_GRAVIDADE[a.gravidade] - PESO_GRAVIDADE[b.gravidade] ||
    (a.prazoAte ?? "9999").localeCompare(b.prazoAte ?? "9999") ||
    idadeHoras(b.desde, agora) - idadeHoras(a.desde, agora) ||
    a.id.localeCompare(b.id);
  const doFiltro = (l: LinhaCentral) => !filtro || l.filtro === filtro;
  return {
    contagens,
    total: Object.values(contagens).reduce((s, n) => s + n, 0),
    linhas: reais.filter(doFiltro).sort(ordem),
    teste: teste.filter(doFiltro).sort(ordem),
  };
}

/** Gravidade pelo prazo: vencido = alta; vence em até 24 h = média; senão a gravidade base da fila. */
export function gravidadePeloPrazo(prazoAte: string | null, agora: Date, base: Gravidade): Gravidade {
  if (!prazoAte) return base;
  const falta = new Date(prazoAte).getTime() - agora.getTime();
  if (falta <= 0) return "alta";
  if (falta <= 24 * 3_600_000 && base === "baixa") return "media";
  return base;
}

/** "vence em 5 h" / "venceu há 2 dias" / null. */
export function textoPrazo(prazoAte: string | null, agora: Date): string | null {
  if (!prazoAte) return null;
  const h = (new Date(prazoAte).getTime() - agora.getTime()) / 3_600_000;
  const quanto = (x: number) => (x < 1 ? "menos de 1 h" : x < 48 ? `${Math.round(x)} h` : `${Math.round(x / 24)} dias`);
  return h >= 0 ? `vence em ${quanto(h)}` : `venceu há ${quanto(-h)}`;
}

/** Link da Central já filtrada (as decisões do topo apontam para cá). */
export const hrefCentral = (filtro: FiltroCentral) => `/admin/pendencias?filtro=${filtro}`;
