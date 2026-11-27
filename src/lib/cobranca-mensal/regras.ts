/*
  E641 — cobrança MENSAL para contratos longos (91 a 180 dias). Lógica PURA, só a parte NEUTRA, atrás da chave
  COBRANCA_MENSAL_ATIVA (desligada até o parecer da Dra. Beatriz). A plataforma nunca toca no dinheiro: o morador paga o dono
  direto; aqui só se calcula o cronograma, se registra quem disse o quê e se lembra, sem cobrar.
    • vencimento no aniversário do check-in; o 1º mês é adiantado (vence no check-in);
    • pró-rata SÓ no período final, com divisor 30;
    • taxa da Viva por mês, no vencimento, sobre o aluguel da parcela;
    • livro de pagamentos em 3 estados; sem registro é "não registrado" (nunca "não pago");
    • lembretes neutros D-5 e D-3; duração acumulada com teto de 180 dias.
  Fora do escopo, de propósito: qualquer status além de "não registrado", encargos, mensagens depois do vencimento,
  notificação formal e consequência ao morador. Isso só entra com o parecer da Dra. Beatriz.
*/

export const DIVISOR_PRORATA = 30;
export const TETO_DIAS_ACUMULADOS = 180;
export const MIN_DIAS_COBRANCA_MENSAL = 91;

export const ESTADOS_DO_LIVRO = ["registrado_morador", "aguardando_confirmacao", "confirmado_dono"] as const;
export type EstadoGravado = (typeof ESTADOS_DO_LIVRO)[number];
export type EstadoDoLivro = EstadoGravado | "nao_registrado";

const MS_DIA = 86_400_000;
const utc = (iso: string) => {
  const [a, m, d] = iso.split("-").map(Number);
  return Date.UTC(a, m - 1, d);
};
const iso = (ms: number) => new Date(ms).toISOString().slice(0, 10);
export const diasEntre = (de: string, ate: string) => Math.round((utc(ate) - utc(de)) / MS_DIA);
const arredonda = (n: number) => Math.round((n + 1e-9) * 100) / 100;

/** Soma meses mantendo o dia do check-in; se o mês não tem esse dia, vale o último dia do mês. */
export function somaMeses(base: string, n: number): string {
  const [a, m, d] = base.split("-").map(Number);
  const alvo = m - 1 + n;
  const ano = a + Math.floor(alvo / 12);
  const mes = ((alvo % 12) + 12) % 12;
  const ultimo = new Date(Date.UTC(ano, mes + 1, 0)).getUTCDate();
  return iso(Date.UTC(ano, mes, Math.min(d, ultimo)));
}

export interface Parcela {
  numero: number;
  venceEm: string;
  tipo: "mensal" | "prorata_final";
  /** Dias cobertos pela parcela (só preenchido na pró-rata final). */
  dias: number | null;
  /** O 1º mês é adiantado: vence no check-in. */
  adiantada: boolean;
  valor: number;
  taxaViva: number;
}

/** A taxa da Viva da parcela: percentual sobre o ALUGUEL da parcela (nenhum outro valor entra na conta). */
export function taxaDaParcela(valorAluguel: number, taxa: number): number {
  return arredonda(valorAluguel * taxa);
}

export function cronogramaMensal(
  f: { checkin: string; checkout: string; aluguelMensal: number; taxa: number },
  /** E647: a forma é escolha do dono nas duas faixas, então o mensal também vale de 30 a 90 dias. O padrão do E641 (91) não muda. */
  opcoes: { minDias?: number } = {},
):
  | { ok: true; dias: number; parcelas: Parcela[] }
  | { ok: false; motivo: string } {
  const minDias = opcoes.minDias ?? MIN_DIAS_COBRANCA_MENSAL;
  const dias = diasEntre(f.checkin, f.checkout);
  if (!(f.aluguelMensal > 0)) return { ok: false, motivo: "Informe o aluguel mensal." };
  if (dias < minDias) return { ok: false, motivo: `A cobrança mensal vale para estadias de ${minDias} a ${TETO_DIAS_ACUMULADOS} dias.` };
  if (dias > TETO_DIAS_ACUMULADOS) return { ok: false, motivo: `A estadia passa de ${TETO_DIAS_ACUMULADOS} dias, o teto da Viva.` };
  const parcelas: Parcela[] = [];
  let cheios = 0;
  while (somaMeses(f.checkin, cheios + 1) <= f.checkout) cheios++;
  for (let i = 0; i < cheios; i++) {
    parcelas.push({ numero: i + 1, venceEm: somaMeses(f.checkin, i), tipo: "mensal", dias: null, adiantada: i === 0, valor: arredonda(f.aluguelMensal), taxaViva: taxaDaParcela(f.aluguelMensal, f.taxa) });
  }
  const resto = diasEntre(somaMeses(f.checkin, cheios), f.checkout);
  if (resto > 0) {
    const valor = arredonda(Math.min(f.aluguelMensal, (f.aluguelMensal / DIVISOR_PRORATA) * resto));
    parcelas.push({ numero: cheios + 1, venceEm: somaMeses(f.checkin, cheios), tipo: "prorata_final", dias: resto, adiantada: false, valor, taxaViva: taxaDaParcela(valor, f.taxa) });
  }
  return { ok: true, dias, parcelas };
}

/** Renovações somam: o total de dias do morador com o dono nunca passa de 180. */
export function duracaoAcumulada(f: { diasJaContratados: number; diasNovos: number }): { ok: true; total: number } | { ok: false; restam: number; motivo: string } {
  const total = f.diasJaContratados + f.diasNovos;
  if (total <= TETO_DIAS_ACUMULADOS) return { ok: true, total };
  const restam = Math.max(0, TETO_DIAS_ACUMULADOS - f.diasJaContratados);
  return { ok: false, restam, motivo: `Somando as renovações, a estadia passaria de ${TETO_DIAS_ACUMULADOS} dias. Restam ${restam} dias.` };
}

export function estadoDoLivro(gravado: string | null | undefined): EstadoDoLivro {
  return (ESTADOS_DO_LIVRO as readonly string[]).includes(gravado ?? "") ? (gravado as EstadoGravado) : "nao_registrado";
}

export const ROTULOS_DO_LIVRO: Record<EstadoDoLivro, { rotulo: string; detalhe: string }> = {
  nao_registrado: { rotulo: "Não registrado", detalhe: "Ninguém registrou este pagamento ainda. Isso não quer dizer que não foi pago." },
  registrado_morador: { rotulo: "Registrado pelo morador", detalhe: "O morador disse que pagou direto ao proprietário." },
  aguardando_confirmacao: { rotulo: "Aguardando confirmação do dono", detalhe: "O proprietário foi avisado e ainda não confirmou o recebimento." },
  confirmado_dono: { rotulo: "Confirmado pelo dono", detalhe: "O proprietário confirmou que recebeu." },
};
export const rotuloDoLivro = (e: EstadoDoLivro) => ROTULOS_DO_LIVRO[e];

type Pode = { ok: true } | { ok: false; motivo: string };
/** O morador registra uma vez; depois disso, quem segue é o dono. */
export function podeRegistrar(gravado: string | null): Pode {
  if (estadoDoLivro(gravado) !== "nao_registrado") return { ok: false, motivo: "Este pagamento já foi registrado." };
  return { ok: true };
}
/** O dono só confirma o que o morador registrou, e a confirmação não se desfaz. */
export function podeConfirmar(gravado: string | null): Pode {
  const e = estadoDoLivro(gravado);
  if (e === "nao_registrado") return { ok: false, motivo: "O morador ainda não registrou este pagamento." };
  if (e === "confirmado_dono") return { ok: false, motivo: "Este pagamento já foi confirmado." };
  return { ok: true };
}

export type Lembrete = "D-5" | "D-3";
/** Lembrete neutro ANTES do vencimento, só enquanto ninguém registrou. Depois do vencimento não há lembrete. */
export function lembreteDaParcela(f: { venceEm: string; hoje: string; estado: string | null }): Lembrete | null {
  if (estadoDoLivro(f.estado) !== "nao_registrado") return null;
  const faltam = diasEntre(f.hoje, f.venceEm);
  return faltam === 5 ? "D-5" : faltam === 3 ? "D-3" : null;
}

const BRL = (n: number) => `R$ ${n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const br = (d: string) => d.split("-").reverse().join("/");
export function textoDoLembrete(_l: Lembrete, p: { valor: number; venceEm: string }): string {
  return `Lembrete: a parcela de ${BRL(p.valor)} do aluguel vence em ${br(p.venceEm)}. O pagamento é feito direto ao proprietário; depois, registre aqui para os dois acompanharem.`;
}
