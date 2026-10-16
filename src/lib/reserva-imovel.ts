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
 * Destino do botão "WhatsApp": o número da Viva (variável pública
 * NEXT_PUBLIC_VIVA_WHATSAPP) com a mensagem pronta; sem número configurado, a
 * Central de Ajuda ("Fale com a Viva"). NUNCA o telefone do proprietário.
 */
export function destinoWhatsappViva(imovelId: string, numeroViva?: string | null): { href: string; externo: boolean } {
  const numero = numeroWhatsappViva(numeroViva);
  if (!numero) return { href: `/ajuda?imovel=${encodeURIComponent(codigoDoImovel(imovelId))}`, externo: false };
  return { href: `https://wa.me/${numero}?text=${encodeURIComponent(mensagemWhatsappViva(imovelId))}`, externo: true };
}
