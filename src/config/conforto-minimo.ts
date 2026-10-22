/*
  Prompt 59, Parte A — PADRÃO MÍNIMO DE CONFORTO (estudo da Fase 0, D1–D7). Lista ÚNICA: o cadastro, o bloqueio de
  publicação no servidor, a conferência de entrada do morador e a exibição (59-A) leem daqui.

  - Ar-condicionado NÃO é exigido (D5): basta ventilação ou climatização em cada quarto.
  - Internet: conta a velocidade INFORMADA; a medida vale para a etiqueta e a ficha, não para o mínimo.
  - Mudou a lista? Suba VERSAO_CONFORTO e marque o item novo com `desdeVersao`: o dono reconfirma só os itens novos
    (os já confirmados continuam valendo).
*/

export const VERSAO_CONFORTO = 1;

/** Anúncio já publicado quando a regra entrou: prazo para confirmar o mínimo (D4). */
export const PRAZO_ADEQUACAO_DIAS = 30;
/** Lembretes ao dono, em dias antes do fim do prazo (pela matriz de notificações). */
export const LEMBRETES_ADEQUACAO_DIAS = [15, 3] as const;

export interface ItemConforto {
  chave: string;
  rotulo: string;
  criterio: string;
  /** Versão da lista em que o item entrou (o dono reconfirma só o que entrou depois da sua confirmação). */
  desdeVersao: number;
}

export const ITENS_CONFORTO = [
  { chave: "cama_colchao", rotulo: "Cama e colchão", criterio: "Cama com colchão em bom estado para cada ocupante anunciado.", desdeVersao: 1 },
  { chave: "roupa_cama_banho", rotulo: "Roupa de cama e banho", criterio: "Roupa de cama e toalhas para cada ocupante anunciado.", desdeVersao: 1 },
  { chave: "agua_quente", rotulo: "Água quente", criterio: "Água quente no chuveiro.", desdeVersao: 1 },
  { chave: "cozinha_basica", rotulo: "Cozinha básica", criterio: "Geladeira, fogão ou cooktop e utensílios básicos.", desdeVersao: 1 },
  { chave: "ventilacao_quartos", rotulo: "Ventilação nos quartos", criterio: "Ventilação ou climatização em cada quarto. Ar-condicionado não é exigido.", desdeVersao: 1 },
  { chave: "iluminacao", rotulo: "Iluminação", criterio: "Luz funcionando em todos os cômodos.", desdeVersao: 1 },
  { chave: "fechadura_entrada", rotulo: "Fechadura na entrada", criterio: "Porta de entrada com fechadura funcionando.", desdeVersao: 1 },
  { chave: "entrega_limpa", rotulo: "Entrega limpa", criterio: "Imóvel limpo e pronto para morar na entrada.", desdeVersao: 1 },
  { chave: "internet_informada", rotulo: "Internet informada", criterio: "Velocidade da internet informada no anúncio.", desdeVersao: 1 },
  { chave: "mobilia_das_fotos", rotulo: "Mobília das fotos", criterio: "A mobília mostrada nas fotos está no imóvel.", desdeVersao: 1 },
] as const satisfies readonly ItemConforto[];

export type ChaveConforto = (typeof ITENS_CONFORTO)[number]["chave"];

export const CHAVES_CONFORTO: readonly ChaveConforto[] = ITENS_CONFORTO.map((i) => i.chave);

export const ehChaveConforto = (v: unknown): v is ChaveConforto => typeof v === "string" && (CHAVES_CONFORTO as readonly string[]).includes(v);

export const itemConforto = (chave: ChaveConforto): ItemConforto => ITENS_CONFORTO.find((i) => i.chave === chave)!;
