/*
  Prompt 58 — números da seção "Dados e retenção" do admin (puro). Só contagens: o painel nunca mostra o caminho
  do arquivo nem o conteúdo eliminado. Contas de teste ficam à parte.
*/

import { dataBRT, diaBRT, horaBRT } from "../datas-brasilia.ts";

export interface LinhaLivro {
  tipo: string;
  motivo: string;
  teste: boolean;
  eliminado_em: string;
}

export interface ResumoSemana {
  total: number;
  teste: number;
  porItem: { tipo: string; motivo: string; n: number; teste: number }[];
}

const ROTULO_MOTIVO: Record<string, string> = { prazo: "prazo", pedido_titular: "pedido do titular", decisao: "decisão" };
export const rotuloMotivo = (m: string) => ROTULO_MOTIVO[m] ?? m;

/** Eliminações reais dos últimos 7 dias, agrupadas por item e motivo. */
export function resumoDaSemana(livro: readonly LinhaLivro[], agora: Date): ResumoSemana {
  const desde = agora.getTime() - 7 * 86_400_000;
  const grupos = new Map<string, { tipo: string; motivo: string; n: number; teste: number }>();
  let total = 0;
  let teste = 0;
  for (const l of livro) {
    if (Date.parse(l.eliminado_em) < desde) continue;
    const k = `${l.tipo}|${l.motivo}`;
    const g = grupos.get(k) ?? { tipo: l.tipo, motivo: l.motivo, n: 0, teste: 0 };
    if (l.teste) {
      g.teste += 1;
      teste += 1;
    } else {
      g.n += 1;
      total += 1;
    }
    grupos.set(k, g);
  }
  return { total, teste, porItem: [...grupos.values()].sort((a, b) => b.n + b.teste - (a.n + a.teste) || a.tipo.localeCompare(b.tipo)) };
}

/**
 * E333: "O que seria apagado hoje (DD/MM/AAAA)" leva a data do DIA DA LEITURA (calendário de Brasília), nunca a do
 * último relatório. A rotina diária roda às 10h; antes dela (ou se ela falhar), os números são da rodada anterior e a
 * nota diz de quando são — antes, no dia 01/11 a tela dizia "hoje (31/10/2026)".
 */
export function cabecalhoRelatorioHoje(diaRelatorio: string | null, geradoEm: string | null, agora: Date): { titulo: string; nota: string | null } {
  const hoje = diaBRT(agora)!;
  const titulo = `O que seria apagado hoje (${dataBRT(agora)})`;
  if (!diaRelatorio) return { titulo, nota: null };
  if (diaRelatorio === hoje) return { titulo, nota: geradoEm ? `Rodada de hoje às ${horaBRT(geradoEm)}.` : null };
  const quando = geradoEm ? `${dataBRT(geradoEm)} às ${horaBRT(geradoEm)}` : dataBRT(`${diaRelatorio}T12:00:00Z`);
  return { titulo, nota: `A rodada de hoje ainda não saiu (a rotina roda às 10h). Os números abaixo são da rodada de ${quando}.` };
}
