/*
  Prompt 49 — entrada única, intenção e momento de valor. PURO e testável.

  - Conta só no momento de valor: quem chega à entrada vindo de uma ação (enviar pedido, mensagem, alerta,
    anunciar, orçamento, denunciar) vê o porquê; a chave vem na URL (?motivo=…) e o texto é fixo daqui (nunca
    texto livre da URL). Depois do código, volta para a ação (?redirect=).
  - Intenção (profiles.intencao: morar | anunciar | servicos) é CAMADA, não papel: define o painel inicial e o
    checklist; nunca mexe em role nem em permissão.
*/

export const MOTIVOS_ENTRADA = {
  pedido: "Para enviar seu pedido, entre com seu e-mail.",
  visita: "Para agendar a visita, entre com seu e-mail.",
  candidatura: "Para enviar sua candidatura, entre com seu e-mail.",
  mensagem: "Para mandar mensagem, entre com seu e-mail.",
  alerta: "Para receber o alerta por e-mail, entre com seu e-mail.",
  anunciar: "Para anunciar seu imóvel, entre com seu e-mail.",
  orcamento: "Para pedir o orçamento, entre com seu e-mail.",
  denunciar: "Para denunciar o anúncio, entre com seu e-mail.",
  favorito: "Para guardar seus favoritos em qualquer aparelho, entre com seu e-mail.",
  busca: "Para salvar a busca em qualquer aparelho, entre com seu e-mail.",
} as const;
export type MotivoEntrada = keyof typeof MOTIVOS_ENTRADA;

export function motivoDaEntrada(chave: string | null | undefined): string | null {
  return chave && Object.hasOwn(MOTIVOS_ENTRADA, chave) ? MOTIVOS_ENTRADA[chave as MotivoEntrada] : null;
}

/** Link para a entrada a partir de um momento de valor: diz o porquê e volta para a ação depois do código. */
export function urlEntrada(motivo: MotivoEntrada, voltarPara: string): string {
  return `/auth?motivo=${motivo}&redirect=${encodeURIComponent(voltarPara)}`;
}

/** Conta nova passa pela tela de intenção antes do destino; conta existente vai direto. */
export function destinoDepoisDaEntrada(destino: string, novo: boolean): string {
  return novo ? `/auth/intencao?redirect=${encodeURIComponent(destino)}` : destino;
}

export const INTENCOES = ["morar", "anunciar", "servicos"] as const;
export type Intencao = (typeof INTENCOES)[number];

export const ROTULO_INTENCAO: Record<Intencao, string> = {
  morar: "Quero morar",
  anunciar: "Tenho imóvel",
  servicos: "Presto serviços",
};

/** Só as 3 chaves, sem repetir, na ordem da lista. Lixo some. */
export function normalizarIntencoes(bruto: unknown): Intencao[] {
  const lista = Array.isArray(bruto) ? bruto : [];
  return INTENCOES.filter((i) => lista.includes(i));
}

/**
 * Painel inicial pela intenção (sem mexer em papel): um destino explícito (a ação que pediu a conta) sempre vence;
 * "Tenho imóvel" abre o painel no modo proprietário, "Quero morar" no modo morador, "Presto serviços" sozinho leva a
 * "Seja parceiro". Nenhuma escolha ("Agora não") → painel padrão.
 */
export function painelInicial(intencoes: Intencao[], destino: string): { destino: string; modo: "owner" | "tenant" | null } {
  const modo = intencoes.includes("anunciar") ? "owner" : intencoes.includes("morar") ? "tenant" : null;
  if (destino && destino !== "/dashboard") return { destino, modo };
  if (intencoes.length === 1 && intencoes[0] === "servicos") return { destino: "/parceiros#h-form", modo };
  return { destino: "/dashboard", modo };
}
