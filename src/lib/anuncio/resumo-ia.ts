import { AMENITY_LABEL } from "../amenities.ts";

/**
 * Resumo curto do que a IA achou nas fotos, para o cartão "Preencher com IA" do passo 1 (prompt 20):
 * "2 quartos, 1 banheiro, Cozinha equipada, Mesa de trabalho". Só o que veio da análise; no máximo 5 itens.
 */
export function resumoDaSugestao(d: { quartos?: number; banheiros?: number; comodidades?: string[] }): string {
  const itens: string[] = [];
  if (d.quartos !== undefined) itens.push(d.quartos === 0 ? "studio (sem quarto separado)" : `${d.quartos} ${d.quartos === 1 ? "quarto" : "quartos"}`);
  if (d.banheiros !== undefined && d.banheiros > 0) itens.push(`${d.banheiros} ${d.banheiros === 1 ? "banheiro" : "banheiros"}`);
  for (const k of d.comodidades ?? []) {
    const rotulo = AMENITY_LABEL[k];
    if (rotulo) itens.push(rotulo.charAt(0).toLowerCase() + rotulo.slice(1));
  }
  return itens.slice(0, 5).join(", ");
}
