/**
 * Coluna de reserva da página do imóvel (ordem 4f8023d1): taxas itemizadas e o
 * WhatsApp da Viva. Lógica pura e testável; o componente só desenha.
 *
 * Regras que não mudam:
 *  - só entram valores INFORMADOS pelo dono (nada estimado);
 *  - a Caução é linha separada (paga uma vez, devolvida no fim) — o valor sai do
 *    contrato, então aqui não se inventa número;
 *  - o WhatsApp vai SEMPRE para a Viva: este módulo nem recebe telefone de dono.
 */
import { textoValorPet } from "./anuncio/pets-regras.ts";
import type { RegrasPets } from "./anuncio/pets-regras.ts";
import { textoLimpezaEstadia, type LimpezaEstadia } from "./anuncio/limpeza-estadia.ts";
import { codigoDoImovel } from "./imovel-pagina.ts";
import { isMotivo, motivoLabel } from "./pedidos/pedidos.ts";
import { formatBRL } from "./utils.ts";
import { totalDoPeriodo } from "./cartao-preco.ts";
import { diasDaSelecao, mesesDaSelecao } from "./imovel/selecao-estadia.ts";

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
}

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
  l.push({ chave: "caucao", rotulo: "Caução", nota: "Paga uma vez, devolvida no fim, após a conferência de saída. O valor fica no contrato." });
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
  /** Linhas "rótulo: valor" do passo de confirmação (datas, motivo, valores). */
  linhas: { rotulo: string; valor: string }[];
}

const ISO_DIA = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Passo de confirmação do "Enviar candidatura": valida o que a pessoa preencheu e
 * monta o resumo (entrada, motivo, valor mensal, Caução, taxa da Viva). Datas em
 * ISO (yyyy-mm-dd), comparadas como texto, sem fuso. Data e motivo são opcionais,
 * mas, se preenchidos, precisam ser válidos — o servidor revalida tudo.
 */
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
}): ResumoSolicitacao {
  const inicio = (e.inicioDesejado ?? "").trim();
  const fim = (e.fimDesejado ?? "").trim();
  const motivo = (e.motivoEstadia ?? "").trim();
  let erro: string | null = null;
  if (inicio && (!ISO_DIA.test(inicio) || inicio < e.hoje)) {
    erro = "A data de entrada precisa ser hoje ou depois. Ajuste ou apague a data para continuar.";
  } else if (fim && (!ISO_DIA.test(fim) || (inicio && fim <= inicio))) {
    erro = "A data de saída precisa ser depois da entrada. Ajuste ou apague a saída para continuar.";
  } else if (motivo && !isMotivo(motivo)) {
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
      { rotulo: "Valor por mês", valor: formatBRL(e.monthlyPrice) },
      ...(e.limpezaEstadia ? [{ rotulo: "Limpeza durante a estadia", valor: textoLimpezaEstadia(e.limpezaEstadia) }] : []),
      ...(typeof e.totalMensal === "number" ? [{ rotulo: "Total por mês", valor: formatBRL(e.totalMensal) }] : []),
      // E53: com o período completo, o total da estadia (mesma conta do cartão e do fechamento: totalDoPeriodo).
      ...(typeof e.totalMensal === "number" && meses
        ? [{ rotulo: "Total da estadia", valor: `${formatBRL(totalDoPeriodo(e.totalMensal, meses))} em ${meses} ${meses === 1 ? "mês" : "meses"}` }]
        : []),
      { rotulo: "Caução", valor: "Paga uma vez, devolvida no fim (valor no contrato)" },
      { rotulo: "Taxa da Viva para você", valor: formatBRL(0) },
    ],
  };
}
