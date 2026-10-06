/*
  Regras da devolução da caução (PURO, node --test). O proprietário declara
  quanto devolveu; o inquilino confirma. A plataforma nunca movimenta o valor.
*/

export const STATUS_CONTRATO_ENCERRADO = ["encerrado_em_acerto", "encerrado_sem_renovacao", "concluido"] as const;
export const MEIOS_DEVOLUCAO = ["pix", "transferencia", "dinheiro", "outro"] as const;

export function regraDevolucao(e: {
  statusContrato: string;
  caucaoTotal: number;
  valorDevolvido: number;
  dataDevolucao: string;
  meio: string;
  jaTemAcerto: boolean;
}): { ok: true; tipo: "devolucao_integral" | "desconto"; valor: number } | { ok: false; error: string } {
  if (!(STATUS_CONTRATO_ENCERRADO as readonly string[]).includes(e.statusContrato)) return { ok: false, error: "A devolução é registrada quando a locação termina." };
  if (!(e.caucaoTotal > 0)) return { ok: false, error: "Não há caução confirmada neste contrato." };
  if (e.jaTemAcerto) return { ok: false, error: "A devolução deste contrato já foi registrada." };
  const valor = Math.round(Number(e.valorDevolvido) * 100) / 100;
  if (!(valor >= 0) || valor > e.caucaoTotal) return { ok: false, error: "O valor devolvido deve ficar entre R$ 0 e o total da caução." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(e.dataDevolucao)) return { ok: false, error: "Informe a data da devolução." };
  if (!(MEIOS_DEVOLUCAO as readonly string[]).includes(e.meio)) return { ok: false, error: "Escolha como a caução foi devolvida." };
  return { ok: true, tipo: valor === e.caucaoTotal ? "devolucao_integral" : "desconto", valor };
}
