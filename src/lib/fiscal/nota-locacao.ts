/*
  E574 — nota fiscal da LOCAÇÃO (espelho do E24 dos parceiros, src/lib/parceiros/fiscal.ts). PURO, node --test.
  Desenho fiscal aprovado (não muda): dono PF não emite nota de locação — a plataforma gera o Recibo de Locação; a Viva
  emite NFS-e só sobre a própria taxa. O proprietário PJ (MEI conta como PJ) DECLARA se emite nota fiscal da locação.
  O filtro "Emite nota fiscal" é selo de confiança sobre a declaração do dono — a Viva não promete documento de
  terceiro. Fonte única para a Conta, a busca e a denúncia.
*/
export const PERGUNTA_NOTA_LOCACAO = "Sua empresa (ou MEI) emite nota fiscal da locação para o morador?";
export const PENDENCIA_NOTA_LOCACAO = "Responda se sua empresa emite nota fiscal da locação para o morador.";
export const AJUDA_NOTA_LOCACAO =
  "É uma declaração sua: com \"Sim\", seus anúncios aparecem no filtro \"Emite nota fiscal\" da busca. A Viva não emite a nota da locação — emite só o documento da própria taxa.";
export const ROTULO_FILTRO_NOTA_LOCACAO = "Emite nota fiscal";
export const MOTIVO_NOTA_NAO_EMITIDA = "Não emitiu a nota fiscal declarada";

export interface DonoFiscal {
  tipoPessoa?: string | null;
  emiteNota?: boolean | null;
}

/** O que o morador recebe da locação: PF → recibo (gerado pela plataforma); PJ que declarou → nota; senão null. */
export function documentoDaLocacao(d: DonoFiscal): "nota" | "recibo" | null {
  if (d.tipoPessoa === "pf") return "recibo";
  if (d.tipoPessoa === "pj" && d.emiteNota === true) return "nota";
  return null;
}

/** O selo/filtro "Emite nota fiscal" do anúncio: só dono PJ que declarou emitir. */
export function donoEmiteNota(d: DonoFiscal): boolean {
  return documentoDaLocacao(d) === "nota";
}

/** PJ que ainda não respondeu: pendência na Conta (não tira do ar o que já está publicado). */
export function faltaRespostaNotaLocacao(d: DonoFiscal): boolean {
  return d.tipoPessoa === "pj" && typeof d.emiteNota !== "boolean";
}

/**
 * Valor a gravar (servidor; nada do navegador é confiado): PJ exige Sim/Não; PF grava sempre null.
 * PJ sem resposta booleana = o documento não conclui.
 */
export function emiteNotaLocacaoParaGravar(tipoPessoa: string | null | undefined, resposta: unknown): { ok: true; valor: boolean | null } | { ok: false; erro: string } {
  if (tipoPessoa === "pf") return { ok: true, valor: null };
  if (tipoPessoa !== "pj") return { ok: false, erro: "Escolha pessoa física ou jurídica." };
  if (typeof resposta !== "boolean") return { ok: false, erro: `${PERGUNTA_NOTA_LOCACAO} Responda Sim ou Não.` };
  return { ok: true, valor: resposta };
}
