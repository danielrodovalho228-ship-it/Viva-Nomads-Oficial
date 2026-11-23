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
  /** Só vale nestes prefixos de caminho (sem caminho informado, vale sempre). */
  escopo?: string[];
  /** Arquivos de HISTÓRICO em que a regra não vale (prefixos de caminho), cada um com o motivo em HISTORICO_078. */
  historico?: string[];
}

/**
 * Prompt 078 (decisão do Daniel, 16/11/2026) — onde "Plano Gestor" e a taxa de 4% ainda podem aparecer: só histórico.
 * Testes (`*.test.ts`, `tests/`) e `docs/` já ficam fora da varredura.
 */
export const HISTORICO_078: { prefixo: string; motivo: string }[] = [
  { prefixo: "supabase/migrations/", motivo: "migrações já aplicadas são imutáveis (0079, 0096, 0100, 0293 criaram o plano e a faixa de 4%)" },
  { prefixo: "supabase/producao/", motivo: "os aplicar/rollback das mesmas migrações" },
  { prefixo: "supabase/testes/", motivo: "fases dos testes de RLS que reaplicam as migrações antigas" },
  { prefixo: "src/config/compare-precos.ts", motivo: "os 4% dali são a taxa do ANFITRIÃO no Airbnb (referência de mercado), não a da Viva" },
];
const HISTORICO_078_PREFIXOS = HISTORICO_078.map((h) => h.prefixo);

/** Superfícies de Parceiros (páginas públicas, componentes, regras e o atendimento sobre parceiros). */
const SUPERFICIES_PARCEIROS = ["src/app/(public)/parceiros/", "src/components/parceiros/", "src/lib/parceiros/", "src/lib/atendimento/parceiros-texto.ts"];

export const FRASES_PROIBIDAS: RegraProibida[] = [
  {
    id: "contato-depois-do-aceite",
    regra: "E445: telefone, e-mail e redes sociais NUNCA são trocados (não existe 'contato depois do aceite' entre morador e proprietário).",
    // Frase que NEGA a troca ("nunca são trocados… inclusive depois do aceite", E764) não é a formulação proibida.
    re: /(telefone|e-?mail|whatsapp|contato( direto)?)(?:(?!nunca|jamais|não|nao|inclusive|mesmo|qualquer)[^.\n"`]){0,60}\b(só )?(depois|após|apos) d?o aceite/i,
  },
  {
    id: "contato-protegido-ate-o-aceite",
    regra: "E785 (variante do E445): 'contato protegido até o aceite' (e parentes: liberado/revelado/compartilhado até ou antes do aceite) sugere que o contato é trocado depois. O certo é a fonte única: telefone, e-mail e redes sociais NUNCA são trocados.",
    // Cobre "contato protegido até o aceite", "e-mail fica oculto até o aceite", "protegemos o contato até o aceite".
    re: /(?:(contato|telefone|e-?mail|whatsapp|dados? de contato)(?:(?!nunca|jamais|não|nao|inclusive|mesmo|qualquer)[^.\n"`]){0,70}\b(protegid|resguardad|liberad|revelad|divulgad|compartilhad|oculto|escondid|visível|visivel|trocad)\w*|\b(protegemos|protegendo|mantemos|guardamos|preservamos|escondemos|ocultamos)\b(?:(?!nunca|jamais|não|nao)[^.\n"`]){0,50}\b(contato|telefone|e-?mail|whatsapp)\b)(?:(?!nunca|jamais|não|nao)[^.\n"`]){0,50}\b(até|ate|antes d)\w*\s+(d?o\s+)?aceite/i,
  },
  {
    id: "plataforma-entrega-contato-do-proprietario",
    regra: "E785 (decisão de 09/11): 'contato do proprietário' (ou do dono/anfitrião) entregue, passado ou revelado pela plataforma sugere troca de contato, contra o E445. Orientação como 'sem contato por fora' é permitida.",
    // Verbo de entrega ANTES: "passamos/a Viva entrega/você recebe o contato do proprietário". Particípio DEPOIS: "contato do dono liberado/revelado/entregue".
    re: /(?<!\b(?:nunca|jamais|n[ãa]o)\s)\b(entreg|pass|envi|repass|reveal|revel|liber|forne[çc]|compartilh|divulg|disponibiliz|mostr|receb)\w*(?:(?!nunca|jamais|n[ãa]o|sem\b)[^.\n"`]){0,40}\bcontatos? d[oea]s? (propriet[áa]ri[oa]|dono|dona|anfitri[ãa]o|locador)|\bcontatos? d[oea]s? (propriet[áa]ri[oa]|dono|dona|anfitri[ãa]o|locador)(?:(?!nunca|jamais|n[ãa]o|sem\b)[^.\n"`]){0,40}\b(entregue|repassad|revelad|liberad|fornecid|compartilhad|divulgad|disponibilizad|enviad)\w*/i,
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
  {
    id: "plano-gestor-publico",
    regra: "Prompt 078 (Daniel, 16/11/2026): o Plano Gestor deixou de ser oferta pública — nenhuma superfície cita 'Plano Gestor'. Carteira a partir de 20 imóveis ou administradora fala com a Viva (TEXTO_CARTEIRAS, config/planos.ts).",
    re: /\bplano\s+gestor\b/i,
    historico: HISTORICO_078_PREFIXOS,
  },
  {
    id: "taxa-de-4-publica",
    regra: "Prompt 078: não existe taxa de serviço de 4% publicada — a escada publicada termina em 16–19 = 6% e vem de lib/cobranca/regra.ts. Condição especial é caso a caso (taxa fixada pelo admin), nunca texto de tela.",
    // "4%" em contexto de taxa: depois de taxa/comissão/gestor/carteira/administradora/até/cobra/menor, ou antes de "por contrato",
    // "do valor total", "sobre o valor", "sem mensalidade/assinatura". "14%", "4,5%" e "0,4%" não entram.
    re: /\b(?:taxa|comiss[ãa]o|gestor|carteiras?|administradoras?|at[ée]|cobra|menor)\b[^.\n"`]{0,60}(?<![\d.,])4\s?%|(?<![\d.,])4\s?%[^.\n"`]{0,40}\b(?:por contrato|do valor total|sobre o valor|sem mensalidade|sem assinatura)\b/i,
    historico: HISTORICO_078_PREFIXOS,
  },
  {
    id: "taxa-na-renovacao-em-pagina-publica",
    regra: "E805: a cobrança da taxa na renovação aguarda o parecer jurídico — não vira promessa nas páginas públicas de venda (/como-funciona e /para-proprietarios).",
    re: /(taxa|comiss[ãa]o|cobrad)[^.\n"`]{0,80}\b(cada|na|por) renova[çc][ãa]o|renova[çc][ãa]o[^.\n"`]{0,40}\b(cobrad|taxa|comiss)/i,
    escopo: ["src/app/(public)/como-funciona/", "src/app/(public)/para-proprietarios/"],
  },
  {
    id: "identidade-revelada-depois-do-aceite-parceiros",
    regra: "E794 (regra E445): em Parceiros nada é revelado nem trocado depois do aceite; o contato nunca é trocado. Não se promete 'identidade revelada depois/após o aceite'.",
    re: /identidade[^.\n"`]{0,30}revelad\w*[^.\n"`]{0,20}(depois|ap[óo]s)\s+(d?o\s+)?aceite/i,
    escopo: SUPERFICIES_PARCEIROS,
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
  { prefixo: "src/lib/atendimento/parceiros-texto.ts", motivo: "texto do atendimento sobre parceiros" },
];

/** Comentário de código não é superfície: linhas que só têm comentário saem da varredura. */
export function semComentarios(codigo: string): string[] {
  // Também o interior de um comentário de bloco (linhas sem o "*" na frente, como no cabeçalho do E764).
  let emBloco = false;
  return codigo.split("\n").map((l) => {
    if (emBloco) {
      if (l.includes("*/")) emBloco = false;
      return "";
    }
    if (/^\s*\/\*/.test(l)) {
      if (!l.includes("*/")) emBloco = true;
      return "";
    }
    return /^\s*(\/\/|\*)/.test(l) ? "" : l;
  });
}

/**
 * `caminho` decide o escopo das regras; `arquivo` (padrão: o próprio caminho) decide só a exceção de histórico — a
 * varredura fora de src/ passa o arquivo sem passar o caminho, para as regras com escopo continuarem valendo lá.
 */
export function achadosProibidos(texto: string, caminho?: string, arquivo: string | undefined = caminho): { id: string; trecho: string }[] {
  const achados: { id: string; trecho: string }[] = [];
  const regras = FRASES_PROIBIDAS.filter((r) => !r.escopo || caminho === undefined || r.escopo.some((x) => caminho.startsWith(x))).filter(
    (r) => !(arquivo !== undefined && r.historico?.some((x) => arquivo.startsWith(x))),
  );
  for (const linha of texto.split("\n")) {
    for (const r of regras) if (r.re.test(linha)) achados.push({ id: r.id, trecho: linha.trim().slice(0, 120) });
  }
  return achados;
}
