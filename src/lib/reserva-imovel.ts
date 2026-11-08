/**
 * Coluna de reserva da página do imóvel (ordem 4f8023d1): taxas itemizadas e o
 * WhatsApp da Viva. Lógica pura e testável; o componente só desenha.
 *
 * Regras que não mudam:
 *  - só entram valores INFORMADOS pelo dono (nada estimado);
 *  - a Caução é linha separada (paga uma vez, devolvida no fim). E752: o valor sai da REGRA do contrato (50% do bloco,
 *    teto de 3 vezes o valor mensal no contrato, direto ao proprietário), então aparece o valor do 1º bloco — não é
 *    número inventado, é a conta de `caucaoDoBloco`;
 *  - o WhatsApp vai SEMPRE para a Viva: este módulo nem recebe telefone de dono.
 */
import { textoValorPet } from "./anuncio/pets-regras.ts";
import type { RegrasPets } from "./anuncio/pets-regras.ts";
import { textoLimpezaEstadia, type LimpezaEstadia } from "./anuncio/limpeza-estadia.ts";
import { codigoDoImovel } from "./imovel-pagina.ts";
import { isMotivo, motivoLabel } from "./pedidos/pedidos.ts";
import { formatBRL } from "./utils.ts";
import { totalDoPeriodo } from "./cartao-preco.ts";
import { formatBRLExato, ROTULO_MENSAL, ROTULO_TOTAL_CONTRATO, ROTULO_TOTAL_MES, type TotalMensal } from "./precos.ts";
import { diasDaSelecao, mesesDaSelecao } from "./imovel/selecao-estadia.ts";
import { caucaoDoBloco, DIAS_POR_MES, MAX_MESES_BLOCO, MESES_POR_BLOCO_PADRAO } from "./contrato-blocos.ts";
import { validarReserva } from "./availability.ts";
import { DIAS_MIN_ESTADIA, diasMaxEstadiaVigente } from "./estadia-em-dias.ts";

export interface LinhaTaxa {
  chave: "mensal" | "condominio" | "consumo" | "preparacao" | "saida" | "pet" | "limpeza" | "caucao" | "viva";
  rotulo: string;
  /** Valor formatado; ausente quando a linha é só texto (ex.: Caução). */
  valor?: string;
  /** Explicação curta embaixo do rótulo. */
  nota?: string;
}

export interface EntradaTaxas {
  monthlyPrice: number;
  condoFee?: number;
  utilitiesMode?: "fixed" | "metered" | string;
  utilitiesEstimate?: number;
  prepFee?: number;
  checkoutCleaningEnabled?: boolean;
  checkoutCleaningFee?: number;
  petsAllowed?: boolean;
  petsRegras?: Pick<RegrasPets, "valorPet" | "valorPetTipo"> | null;
  /** Pacote de limpeza durante a estadia (ordem 4c74ac38, item 3). */
  limpezaEstadia?: LimpezaEstadia | null;
  /** E752: estadia mínima do anúncio, para o tamanho do 1º bloco da Caução. */
  minPeriodDays?: number | null;
}

/**
 * E752 — a Caução do 1º bloco, pela regra do contrato (50% do valor do bloco, no máximo 3 vezes o valor mensal no
 * contrato). O bloco é o da estadia mínima do anúncio (1 a 3 meses); sem ela, o bloco padrão de 2 meses.
 */
export function caucaoDoPrimeiroBloco(monthlyPrice: number, minPeriodDays?: number | null): { valor: number; meses: number } | null {
  if (!(typeof monthlyPrice === "number" && Number.isFinite(monthlyPrice) && monthlyPrice > 0)) return null;
  const meses =
    typeof minPeriodDays === "number" && minPeriodDays > 0 ? Math.min(MAX_MESES_BLOCO, Math.max(1, Math.ceil(minPeriodDays / DIAS_POR_MES))) : MESES_POR_BLOCO_PADRAO;
  const valor = caucaoDoBloco(monthlyPrice * meses, monthlyPrice, 0);
  return valor > 0 ? { valor, meses } : null;
}

/** Texto da regra da Caução, sem número (o mesmo em todo lugar do anúncio). */
export const NOTA_CAUCAO =
  "50% do valor de cada bloco, no máximo 3 vezes o valor mensal no contrato. Paga direto ao proprietário e devolvida no fim, após a conferência de saída. A Viva não recebe nem segura esse dinheiro.";

const positivo = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n) && n > 0;

/** Linhas do cartão de reserva, na ordem em que a pessoa lê. */
export function linhasDeTaxas(p: EntradaTaxas): LinhaTaxa[] {
  const l: LinhaTaxa[] = [{ chave: "mensal", rotulo: "Valor por mês", valor: formatBRL(p.monthlyPrice) }];
  if (positivo(p.condoFee)) l.push({ chave: "condominio", rotulo: "Condomínio", valor: formatBRL(p.condoFee) });
  if (p.utilitiesMode === "fixed" && positivo(p.utilitiesEstimate)) {
    l.push({ chave: "consumo", rotulo: "Água, luz e gás (valor fixo)", valor: formatBRL(p.utilitiesEstimate) });
  }
  if (positivo(p.prepFee)) {
    l.push({ chave: "preparacao", rotulo: "Limpeza de preparação", valor: formatBRL(p.prepFee), nota: "Cobrada uma única vez." });
  }
  if (p.checkoutCleaningEnabled && positivo(p.checkoutCleaningFee)) {
    l.push({ chave: "saida", rotulo: "Limpeza de saída", valor: formatBRL(p.checkoutCleaningFee) });
  }
  const pet = p.petsAllowed ? textoValorPet(p.petsRegras) : null;
  if (pet) l.push({ chave: "pet", rotulo: pet });
  if (p.limpezaEstadia) {
    const pago = p.limpezaEstadia.valorMes > 0;
    l.push({
      chave: "limpeza",
      rotulo: `Limpeza durante a estadia: ${textoLimpezaEstadia(p.limpezaEstadia)}`,
      ...(pago ? { valor: formatBRL(p.limpezaEstadia.valorMes), nota: "Entra no total por mês." } : {}),
    });
  }
  const caucao = caucaoDoPrimeiroBloco(p.monthlyPrice, p.minPeriodDays);
  l.push({
    chave: "caucao",
    rotulo: caucao ? `Caução do 1º bloco (${caucao.meses} ${caucao.meses === 1 ? "mês" : "meses"})` : "Caução",
    ...(caucao ? { valor: formatBRL(caucao.valor) } : {}),
    nota: NOTA_CAUCAO,
  });
  l.push({ chave: "viva", rotulo: "Taxa da Viva para você", valor: formatBRL(0) });
  return l;
}

/**
 * Destino do botão de contato com a Viva: a plataforma NÃO tem número oficial de
 * WhatsApp (decisão do Daniel, 16/10). O botão é sempre "Falar com a Viva" e leva ao
 * atendimento da plataforma com o código do imóvel. NUNCA o telefone do proprietário.
 */
export function destinoContatoViva(imovelId: string): { href: string; rotulo: string } {
  return { href: `/ajuda?imovel=${encodeURIComponent(codigoDoImovel(imovelId))}`, rotulo: "Falar com a Viva" };
}

export interface ResumoSolicitacao {
  /** Mensagem visível quando algo não pode seguir (ex.: data de entrada no passado). */
  erro: string | null;
  /**
   * Linhas "rótulo: valor" do passo de confirmação (datas, motivo, valores). E584: `revisar` marca as parcelas que o
   * passo 1 mostra à vista, com o rótulo do painel do anúncio (contas, condomínio, limpeza de preparação/saída).
   */
  linhas: { rotulo: string; valor: string; revisar?: true }[];
}

/** E584: rótulo da limpeza de preparação no passo 1 — o mesmo do painel do anúncio ("Cobrada uma única vez."). */
export const ROTULO_PREPARACAO_PASSO1 = "Limpeza de preparação — cobrada uma única vez";

/**
 * E584: as parcelas do anúncio que o passo 1 nomeia, tiradas da MESMA conta do painel (calcularTotalMensal): por mês,
 * condomínio e água/luz/gás; uma vez só, a limpeza de preparação e a de saída. Nenhum número novo.
 */
export function parcelasDoResumo(mes: Pick<TotalMensal, "linhas" | "unicos">): {
  parcelasMes: { rotulo: string; valor: number }[];
  pagamentosUnicos: { rotulo: string; valor: number }[];
} {
  return {
    parcelasMes: mes.linhas.filter((l) => (l.chave === "condominio" || l.chave === "contas") && l.valor > 0).map((l) => ({ rotulo: l.rotulo, valor: l.valor })),
    pagamentosUnicos: mes.unicos
      .filter((u) => u.valor > 0)
      .map((u) => ({ rotulo: u.chave === "preparacao" ? ROTULO_PREPARACAO_PASSO1 : u.rotulo, valor: u.valor })),
  };
}

const ISO_DIA = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Passo de confirmação do "Enviar candidatura": valida o que a pessoa preencheu e
 * monta o resumo (entrada, motivo, valor mensal, Caução, taxa da Viva). Datas em
 * ISO (yyyy-mm-dd), comparadas como texto, sem fuso. Data e motivo são opcionais,
 * mas, se preenchidos, precisam ser válidos — o servidor revalida tudo.
 */
const brDe = (iso: string) => iso.slice(0, 10).split("-").reverse().join("/");

/** E520: o período da proposta conferido pela regra do calendário (validarReserva), com a data que vale na mensagem. */
function erroDoPeriodo(
  inicio: string,
  fim: string,
  hoje: string,
  j: NonNullable<Parameters<typeof resumoSolicitacao>[0]["janela"]>,
): string | null {
  if (!inicio) return "Escolha a data de entrada para continuar.";
  if (!fim) return "Escolha a data de saída (até quando quer ficar) para continuar.";
  const de = j.availableFrom ? j.availableFrom.slice(0, 10) : null;
  const desde = de && de > hoje ? de : hoje;
  const until = j.availableUntil ? j.availableUntil.slice(0, 10) : null;
  const teto = diasMaxEstadiaVigente(j.faixa91a180Ativa);
  const minDias = Math.min(teto, Math.max(DIAS_MIN_ESTADIA, Math.round(Number(j.minDias) || DIAS_MIN_ESTADIA)));
  const maxDias = Math.min(teto, Math.max(minDias, Math.round(Number(j.maxDias) || teto)));
  const r = validarReserva({ checkIn: inicio, checkOut: fim, fromISO: desde, untilISO: until, minDias, maxDias });
  if (r.ok) return null;
  if (/antes do início/.test(r.motivo ?? "")) return `A entrada é antes do início da disponibilidade (${brDe(desde)}). Escolha a partir de ${brDe(desde)}.`;
  if (/fim da disponibilidade/.test(r.motivo ?? "") && until) return `A saída passa do fim da disponibilidade (${brDe(until)}). Ajuste a saída.`;
  if (/mínima|máxima/.test(r.motivo ?? "")) return `${r.motivo} Este período tem ${r.dias} dias; ajuste a entrada ou a saída.`;
  return `${r.motivo ?? "Período inválido."} Ajuste as datas para continuar.`;
}

export function resumoSolicitacao(e: {
  monthlyPrice: number;
  inicioDesejado?: string;
  /** E53: saída escolhida no calendário, na caixa ou no diálogo (opcional; precisa ser depois da entrada). */
  fimDesejado?: string;
  motivoEstadia?: string;
  hoje: string;
  limpezaEstadia?: LimpezaEstadia | null;
  /** Custo total do mês (calcularTotalMensal): quando vem, o resumo mostra a linha "Total por mês". */
  totalMensal?: number;
  /**
   * E519: a estadia do imóvel pela MESMA função do painel (estadiaDoImovel: total por mês × meses + preparação e saída),
   * com a conta aberta. Sem ela, o total é só o mês × meses (sem inventar taxa).
   */
  estadia?: { meses: number; total: number; conta: string } | null;
  /**
   * E562 (telas): a estadia em DIAS exatos (estadiaDoImovelEmDias: total por mês × dias ÷ 30 + preparação e saída).
   * Vence a estadia em meses: com ela o resumo diz "Total da estadia (43 dias)", com "1 mês + 13 dias".
   */
  estadiaDias?: { dias: number; total: number; conta: string; periodo: string; rotulo: string } | null;
  /** E584: parcelas do mês além do aluguel (condomínio, água/luz/gás), com o rótulo do painel — parcelasDoResumo. */
  parcelasMes?: { rotulo: string; valor: number }[];
  /** E584: pagamentos de uma vez (limpeza de preparação, de saída), com o rótulo do painel — parcelasDoResumo. */
  pagamentosUnicos?: { rotulo: string; valor: number }[];
  /** E520: o campo de entrada tem texto que não é uma data real (o valor chega vazio, mas a pessoa digitou algo). */
  entradaInvalida?: boolean;
  /** E520: idem para a saída. */
  saidaInvalida?: boolean;
  /**
   * E520 (reprova 05/11): a janela do anúncio. Com ela, entrada e saída são obrigatórias e o período passa pela MESMA
   * regra do calendário de disponibilidade (validarReserva): dentro da disponibilidade e entre o prazo mínimo e o
   * máximo do anúncio, no intervalo de 30 a 180 dias (o teto vigente da trava FAIXA_91_180).
   */
  janela?: { availableFrom?: string | null; availableUntil?: string | null; minDias?: number | null; maxDias?: number | null; faixa91a180Ativa?: boolean } | null;
}): ResumoSolicitacao {
  const inicio = (e.inicioDesejado ?? "").trim();
  const fim = (e.fimDesejado ?? "").trim();
  const motivo = (e.motivoEstadia ?? "").trim();
  let erro: string | null = null;
  if (e.entradaInvalida) {
    erro = "A data de entrada está incompleta ou não existe. Corrija (dd/mm/aaaa) ou apague para continuar.";
  } else if (e.saidaInvalida) {
    erro = "A data de saída está incompleta ou não existe. Corrija (dd/mm/aaaa) ou apague para continuar.";
  } else if (inicio && (!ISO_DIA.test(inicio) || inicio < e.hoje)) {
    erro = "A data de entrada precisa ser hoje ou depois. Ajuste ou apague a data para continuar.";
  } else if (fim && (!ISO_DIA.test(fim) || (inicio && fim <= inicio))) {
    erro = "A data de saída precisa ser depois da entrada. Ajuste ou apague a saída para continuar.";
  } else if (e.janela) {
    erro = erroDoPeriodo(inicio, fim, e.hoje, e.janela);
  }
  if (!erro && motivo && !isMotivo(motivo)) {
    erro = "Escolha um motivo da lista ou marque “Prefiro não informar”.";
  }
  const [a, m, d] = inicio.split("-");
  const [af, mf, df] = fim.split("-");
  const periodo = { entrada: inicio, saida: fim };
  const dias = diasDaSelecao(periodo);
  const meses = mesesDaSelecao(periodo);
  return {
    erro,
    linhas: [
      { rotulo: "Entrada", valor: inicio && ISO_DIA.test(inicio) ? `${d}/${m}/${a}` : "A combinar com o proprietário" },
      { rotulo: "Saída", valor: fim && ISO_DIA.test(fim) ? `${df}/${mf}/${af}${dias ? ` (${dias} ${dias === 1 ? "dia" : "dias"})` : ""}` : "A combinar com o proprietário" },
      { rotulo: "Motivo da estadia", valor: motivo && isMotivo(motivo) ? motivoLabel(motivo) : "Prefiro não informar" },
      // E519: os rótulos da casa (PROP-2) — Mensal · Total por mês (com contas) · Total do contrato.
      { rotulo: ROTULO_MENSAL, valor: formatBRL(e.monthlyPrice) },
      // E584: cada parcela do mês com linha própria, como no painel do anúncio (antes só implícitas no total por mês).
      ...(e.parcelasMes ?? []).map((p) => ({ rotulo: p.rotulo, valor: formatBRL(p.valor), revisar: true as const })),
      ...(e.limpezaEstadia ? [{ rotulo: "Limpeza durante a estadia", valor: textoLimpezaEstadia(e.limpezaEstadia) }] : []),
      ...(typeof e.totalMensal === "number" ? [{ rotulo: ROTULO_TOTAL_MES, valor: formatBRL(e.totalMensal) }] : []),
      // E584: o que se paga uma vez só (antes só dentro da "Conta do total").
      ...(e.pagamentosUnicos ?? []).map((p) => ({ rotulo: p.rotulo, valor: formatBRL(p.valor), revisar: true as const })),
      // E53/E519: com o período completo, o total — a mesma conta do painel (estadiaDoImovel), com a conta aberta.
      ...(dias && e.estadiaDias && e.estadiaDias.dias === dias
        ? [
            { rotulo: e.estadiaDias.rotulo, valor: `${formatBRLExato(e.estadiaDias.total)} (${e.estadiaDias.periodo})` },
            { rotulo: "Conta do total", valor: `${e.estadiaDias.conta} = ${formatBRLExato(e.estadiaDias.total)}` },
          ]
        : meses && e.estadia && e.estadia.meses === meses
        ? [
            { rotulo: ROTULO_TOTAL_CONTRATO, valor: `${formatBRL(e.estadia.total)} em ${meses} ${meses === 1 ? "mês" : "meses"}` },
            { rotulo: "Conta do total", valor: `${e.estadia.conta} = ${formatBRL(e.estadia.total)}` },
          ]
        : typeof e.totalMensal === "number" && meses
          ? [{ rotulo: ROTULO_TOTAL_CONTRATO, valor: `${formatBRL(totalDoPeriodo(e.totalMensal, meses))} em ${meses} ${meses === 1 ? "mês" : "meses"}` }]
          : []),
      { rotulo: "Caução", valor: caucaoDoPrimeiroBloco(e.monthlyPrice, e.janela?.minDias) ? `${formatBRL(caucaoDoPrimeiroBloco(e.monthlyPrice, e.janela?.minDias)!.valor)} no 1º bloco, paga direto ao proprietário e devolvida no fim` : "Paga uma vez, devolvida no fim (valor no contrato)" },
      { rotulo: "Taxa da Viva para você", valor: formatBRL(0) },
    ],
  };
}
