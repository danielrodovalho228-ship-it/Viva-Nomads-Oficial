/*
  E776 — formulações PROIBIDAS por regra aprovada, em qualquer superfície (texto de tela, e-mail, FAQ, prompt).
  PURO. O teste `frases-proibidas.test.ts` varre `src/` com estas regras e falha o CI se uma delas reaparecer.
  A frase certa mora em `src/config/textos-regulados.ts`.
*/
export interface RegraProibida {
  id: string;
  /** O que a regra aprovada diz. */
  regra: string;
  re: RegExp;
}

export const FRASES_PROIBIDAS: RegraProibida[] = [
  {
    id: "contato-depois-do-aceite",
    regra: "E445: telefone, e-mail e redes sociais NUNCA são trocados (não existe 'contato depois do aceite' entre morador e proprietário).",
    re: /(telefone|e-?mail|whatsapp|contato( direto)?)[^.\n"`]{0,60}\b(só )?(depois|após|apos) d?o aceite/i,
  },
  {
    id: "caucao-em-poupanca",
    regra: "Caução: paga direto ao proprietário; a Viva não recebe nem segura o dinheiro. Não se promete 'em poupança' nas frases públicas.",
    re: /cau[çc][ãa]o[^.\n"`]{0,60}\b(em|na|numa|uma) (uma )?poupan|depositad[ao] em poupan|cau[çc][ãa]o fica em (uma )?poupan/i,
  },
  {
    id: "taxa-cobrada-do-morador",
    regra: "Taxas: a taxa da Viva é cobrada só do proprietário; o morador não paga taxa da plataforma.",
    re: /taxa[^.\n"`]{0,40}\b(cobrad[ao]|paga)\b[^.\n"`]{0,20}\b(d[oa]|pel[oa]) (morador|inquilin)/i,
  },
];

/**
 * Superfícies FORA do gate, de forma explícita e justificada (cada entrada tem teste que confere que ainda existe):
 *  • fluxo de PARCEIROS (serviços): a liberação do contato do parceiro depois do aceite é regra própria, já implementada
 *    em `src/lib/parceiros/pedido-actions.ts` (L2-B item 16); o texto descreve o que o código faz.
 */
export const FORA_DO_GATE: { prefixo: string; motivo: string }[] = [
  { prefixo: "src/lib/parceiros/", motivo: "fluxo de parceiros: contato liberado depois do aceite (L2-B item 16)" },
  { prefixo: "src/components/parceiros/", motivo: "fluxo de parceiros: contato liberado depois do aceite (L2-B item 16)" },
  { prefixo: "src/app/(public)/parceiros/", motivo: "páginas públicas de parceiros: mesma regra do fluxo de parceiros" },
  { prefixo: "src/lib/atendimento/parceiros-texto.ts", motivo: "texto do atendimento sobre parceiros" },
];

/** Comentário de código não é superfície: linhas que só têm comentário saem da varredura. */
export function semComentarios(codigo: string): string[] {
  return codigo.split("\n").map((l) => (/^\s*(\/\/|\*|\/\*)/.test(l) ? "" : l));
}

export function achadosProibidos(texto: string): { id: string; trecho: string }[] {
  const achados: { id: string; trecho: string }[] = [];
  for (const linha of texto.split("\n")) {
    for (const r of FRASES_PROIBIDAS) if (r.re.test(linha)) achados.push({ id: r.id, trecho: linha.trim().slice(0, 120) });
  }
  return achados;
}
