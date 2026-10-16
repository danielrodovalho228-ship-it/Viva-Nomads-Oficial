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
import { codigoDoImovel } from "./imovel-pagina.ts";
import { isMotivo, motivoLabel } from "./pedidos/pedidos.ts";
import { formatBRL } from "./utils.ts";

export interface LinhaTaxa {
  chave: "mensal" | "condominio" | "consumo" | "preparacao" | "saida" | "pet" | "caucao" | "viva";
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
  l.push({ chave: "caucao", rotulo: "Caução", nota: "Paga uma vez, devolvida no fim. O valor fica no contrato." });
  l.push({ chave: "viva", rotulo: "Taxa da Viva para você", valor: formatBRL(0) });
  return l;
}

/** Só dígitos, 12 a 13 (55 + DDD + número) — senão o WhatsApp não é montado. */
export function numeroWhatsappViva(bruto: string | undefined | null): string | null {
  const d = String(bruto ?? "").replace(/\D/g, "");
  return /^55\d{10,11}$/.test(d) ? d : null;
}

/** Mensagem pré-preenchida: cita só o código do imóvel (nunca endereço nem contato). */
export function mensagemWhatsappViva(imovelId: string): string {
  return `Olá, Viva! Tenho interesse no imóvel ${codigoDoImovel(imovelId)}.`;
}

/**
 * Destino do botão de contato com a Viva: com o número público da Viva
 * (NEXT_PUBLIC_WHATSAPP_VIVA, ou o nome antigo NEXT_PUBLIC_VIVA_WHATSAPP) abre o
 * WhatsApp com a mensagem pronta; SEM número, o botão NÃO promete WhatsApp: vira
 * "Falar com a Viva" e leva ao atendimento com o código do imóvel. NUNCA o telefone
 * do proprietário.
 */
export function destinoWhatsappViva(
  imovelId: string,
  numeroViva?: string | null,
): { href: string; externo: boolean; rotulo: string } {
  const numero = numeroWhatsappViva(numeroViva);
  if (!numero) {
    return { href: `/ajuda?imovel=${encodeURIComponent(codigoDoImovel(imovelId))}`, externo: false, rotulo: "Falar com a Viva" };
  }
  return {
    href: `https://wa.me/${numero}?text=${encodeURIComponent(mensagemWhatsappViva(imovelId))}`,
    externo: true,
    rotulo: "WhatsApp da Viva",
  };
}

export interface ResumoSolicitacao {
  /** Mensagem visível quando algo não pode seguir (ex.: data de entrada no passado). */
  erro: string | null;
  /** Linhas "rótulo: valor" do passo de confirmação (datas, motivo, valores). */
  linhas: { rotulo: string; valor: string }[];
}

const ISO_DIA = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Passo de confirmação do "Solicitar reserva": valida o que a pessoa preencheu e
 * monta o resumo (entrada, motivo, valor mensal, Caução, taxa da Viva). Datas em
 * ISO (yyyy-mm-dd), comparadas como texto, sem fuso. Data e motivo são opcionais,
 * mas, se preenchidos, precisam ser válidos — o servidor revalida tudo.
 */
export function resumoSolicitacao(e: {
  monthlyPrice: number;
  inicioDesejado?: string;
  motivoEstadia?: string;
  hoje: string;
}): ResumoSolicitacao {
  const inicio = (e.inicioDesejado ?? "").trim();
  const motivo = (e.motivoEstadia ?? "").trim();
  let erro: string | null = null;
  if (inicio && (!ISO_DIA.test(inicio) || inicio < e.hoje)) {
    erro = "A data de entrada precisa ser hoje ou depois. Ajuste ou apague a data para continuar.";
  } else if (motivo && !isMotivo(motivo)) {
    erro = "Escolha um motivo da lista ou marque “Prefiro não informar”.";
  }
  const [a, m, d] = inicio.split("-");
  return {
    erro,
    linhas: [
      { rotulo: "Entrada", valor: inicio && ISO_DIA.test(inicio) ? `${d}/${m}/${a}` : "A combinar com o proprietário" },
      { rotulo: "Motivo da estadia", valor: motivo && isMotivo(motivo) ? motivoLabel(motivo) : "Prefiro não informar" },
      { rotulo: "Valor por mês", valor: formatBRL(e.monthlyPrice) },
      { rotulo: "Caução", valor: "Paga uma vez, devolvida no fim (valor no contrato)" },
      { rotulo: "Taxa da Viva para você", valor: formatBRL(0) },
    ],
  };
}
