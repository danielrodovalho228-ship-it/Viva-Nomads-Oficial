/*
  Adendo 59.1 — NÍVEIS Essencial / Conforto / Premium (modelo aprovado pelo Daniel em 22/10, ajustes (a)–(e) e Revisão 1).
  Constante ÚNICA: o cálculo do nível, a página do dono, a conferência de entrada, a busca e a exibição (Pista A) leem
  daqui. Os critérios mudam aqui, por configuração, sem novo prompt.

  - Segurança, estrutura e limpeza NÃO têm nível: são condição para qualquer publicação (fechadura, sem risco
    elétrico ou de gás visível, câmeras conforme a declaração, entrega "pronto para morar"). Ficam no mínimo do 59.
  - Essencial = os 12 itens do padrão mínimo (src/config/conforto-minimo.ts, versão 2), por autodeclaração.
  - Conforto e Premium: cada item "declarado" só conta com declaração + FOTO (uma por item, sem pessoas). Os itens
    "medida" vêm da medição do Prompt 57 por ponto; "ruído" vem das 4 perguntas de exposição.
  - Os requisitos são CUMULATIVOS: Premium exige também os itens do Conforto da mesma área.
  - Nível NÃO é selo, NÃO muda a taxa de serviço e NÃO compra posição na busca: pesa só na nota de qualidade.
  - Nada financeiro (D7).
*/

import { ehChaveConforto, itemConforto } from "./conforto-minimo.ts";

export const NIVEIS = ["essencial", "conforto", "premium"] as const;
export type Nivel = (typeof NIVEIS)[number];
/** Abaixo do Essencial: interno, sem nome público; o anúncio não publica (bloqueio do 59). */
export type NivelOuAdequacao = Nivel | "em_adequacao";

export const ROTULO_NIVEL: Record<Nivel, string> = { essencial: "Essencial", conforto: "Conforto", premium: "Premium" };

export const AREAS = ["sono", "clima", "banho", "cozinha", "sala", "trabalho", "internet", "lavanderia", "ruido"] as const;
export type Area = (typeof AREAS)[number];

export const ROTULO_AREA: Record<Area, string> = {
  sono: "Sono",
  clima: "Clima",
  banho: "Banho",
  cozinha: "Cozinha e refeição",
  sala: "Sala",
  trabalho: "Trabalho",
  internet: "Internet",
  lavanderia: "Lavanderia",
  ruido: "Ruído",
};

/** Como o item se prova: declaração + foto (dono), medida do 57 por ponto, ou a classe de ruído. */
export type ProvaItem = "foto" | "medida" | "ruido";

export interface ItemNivel {
  chave: string;
  rotulo: string;
  criterio: string;
  prova: ProvaItem;
}

/** Itens de Conforto e Premium (os do Essencial são os 12 do padrão mínimo). */
export const ITENS_NIVEL = [
  // Sono
  { chave: "sono_dois_jogos", rotulo: "2 jogos de roupa de cama", criterio: "Dois jogos de roupa de cama por cama.", prova: "foto" },
  { chave: "sono_dois_travesseiros", rotulo: "2 travesseiros por pessoa", criterio: "Dois travesseiros por pessoa.", prova: "foto" },
  { chave: "sono_padrao_hotel", rotulo: "Cama padrão hotel", criterio: "Colchão sem afundamento e com protetor, 2 jogos de enxoval por cama e edredom ou cobertor por estação.", prova: "foto" },
  { chave: "sono_cortina_escura", rotulo: "Cortina que escurece", criterio: "Cortina que escurece o quarto.", prova: "foto" },
  // Clima
  { chave: "ar_quarto_principal", rotulo: "Ar-condicionado no quarto principal", criterio: "Ar-condicionado funcionando no quarto principal.", prova: "foto" },
  { chave: "ar_todos_quartos", rotulo: "Ar-condicionado em todos os quartos", criterio: "Ar-condicionado em cada quarto (uma foto mostrando os aparelhos).", prova: "foto" },
  { chave: "ar_sala", rotulo: "Ar-condicionado na sala", criterio: "Ar-condicionado na sala.", prova: "foto" },
  // Banho
  { chave: "banho_dois_jogos_toalhas", rotulo: "2 jogos de toalhas por pessoa", criterio: "Dois jogos de toalhas (banho e rosto) por pessoa.", prova: "foto" },
  { chave: "banho_rosto_tapete", rotulo: "Toalha de rosto e tapete", criterio: "Toalha de rosto e tapete de banheiro.", prova: "foto" },
  // Cozinha e refeição
  { chave: "cozinha_microondas", rotulo: "Micro-ondas", criterio: "Micro-ondas funcionando.", prova: "foto" },
  { chave: "mesa_jantar_todos", rotulo: "Mesa de jantar para todos", criterio: "Mesa e cadeiras de jantar para todos os ocupantes.", prova: "foto" },
  { chave: "cozinha_forno", rotulo: "Forno", criterio: "Forno funcionando.", prova: "foto" },
  { chave: "louca_completa", rotulo: "Louça completa", criterio: "Louça e utensílios completos para todos os ocupantes.", prova: "foto" },
  // Sala
  { chave: "sala_assentos", rotulo: "Assento para todos na sala", criterio: "Assento na sala para todos os ocupantes.", prova: "foto" },
  // Trabalho
  { chave: "trabalho_mesa_cadeira", rotulo: "Mesa e cadeira de trabalho", criterio: "Mesa de trabalho e cadeira.", prova: "foto" },
  { chave: "trabalho_cadeira_regulavel", rotulo: "Cadeira com regulagem de altura", criterio: "Cadeira de trabalho com regulagem de altura.", prova: "foto" },
  // Internet (medida do Prompt 57, por ponto)
  { chave: "internet_medida_quarto", rotulo: "Internet medida no quarto principal", criterio: "Medição válida (Prompt 57) no quarto principal.", prova: "medida" },
  { chave: "internet_medida_trabalho", rotulo: "Internet medida no ponto de trabalho", criterio: "Medição válida (Prompt 57) no ponto de trabalho.", prova: "medida" },
  { chave: "internet_videochamada_trabalho", rotulo: "Videochamada no ponto de trabalho", criterio: "A medição do ponto de trabalho passa a regra de videochamada.", prova: "medida" },
  // Lavanderia
  { chave: "lavadora_no_imovel", rotulo: "Máquina de lavar no imóvel", criterio: "Máquina de lavar dentro do imóvel.", prova: "foto" },
  { chave: "lavadora_secadora", rotulo: "Lavadora e secadora", criterio: "Lavadora e secadora, ou lava e seca, no imóvel.", prova: "foto" },
  // Ruído
  { chave: "ruido_controlado", rotulo: "Ruído sob controle", criterio: "Ruído não é alto, ou é alto com janela de isolamento acústico.", prova: "ruido" },
] as const satisfies readonly ItemNivel[];

export type ChaveNivel = (typeof ITENS_NIVEL)[number]["chave"];
export const CHAVES_NIVEL: readonly ChaveNivel[] = ITENS_NIVEL.map((i) => i.chave);
export const ehChaveNivel = (v: unknown): v is ChaveNivel => typeof v === "string" && (CHAVES_NIVEL as readonly string[]).includes(v);
export const itemNivel = (chave: ChaveNivel): ItemNivel => ITENS_NIVEL.find((i) => i.chave === chave)!;
/** Itens provados por foto (os que a página do dono pede). */
export const CHAVES_NIVEL_FOTO: readonly ChaveNivel[] = ITENS_NIVEL.filter((i) => i.prova === "foto").map((i) => i.chave);

/**
 * A MATRIZ: por área, os itens do Essencial (chaves do padrão mínimo; vazio = sem exigência) e os itens a MAIS de
 * Conforto e de Premium. Cumulativa: Premium = Essencial + Conforto + Premium da área.
 */
export const MATRIZ: Record<Area, { essencial: readonly string[]; conforto: readonly ChaveNivel[]; premium: readonly ChaveNivel[] }> = {
  sono: { essencial: ["cama_colchao", "roupa_cama_banho", "apoio_cama"], conforto: ["sono_dois_jogos", "sono_dois_travesseiros"], premium: ["sono_padrao_hotel", "sono_cortina_escura"] },
  clima: { essencial: ["ventilacao_quartos"], conforto: ["ar_quarto_principal"], premium: ["ar_todos_quartos", "ar_sala"] },
  banho: { essencial: ["agua_quente", "roupa_cama_banho"], conforto: ["banho_dois_jogos_toalhas"], premium: ["banho_rosto_tapete"] },
  cozinha: { essencial: ["cozinha_basica"], conforto: ["cozinha_microondas", "mesa_jantar_todos"], premium: ["cozinha_forno", "louca_completa"] },
  sala: { essencial: [], conforto: ["sala_assentos"], premium: ["ar_sala"] },
  trabalho: { essencial: [], conforto: ["trabalho_mesa_cadeira"], premium: ["trabalho_cadeira_regulavel", "internet_videochamada_trabalho"] },
  internet: { essencial: ["internet_informada"], conforto: ["internet_medida_quarto", "internet_medida_trabalho"], premium: ["internet_videochamada_trabalho"] },
  lavanderia: { essencial: ["lavanderia_acesso"], conforto: ["lavadora_no_imovel"], premium: ["lavadora_secadora"] },
  ruido: { essencial: [], conforto: ["ruido_controlado"], premium: ["ruido_controlado"] },
};

// ── Ruído (item 4) ────────────────────────────────────────────────────────────────────────────────────────────────
/** As 4 perguntas de exposição (o dono responde no cadastro; o morador confere na entrada; a vistoria classifica). */
export const PERGUNTAS_RUIDO = [
  { chave: "via_intensa", texto: "Há via de tráfego intenso na fachada?" },
  { chave: "noturno_obra_100m", texto: "Há bares, casas de show ou obra a até 100 m?" },
  { chave: "aviao_ferrovia", texto: "O imóvel fica em rota de avião ou perto de ferrovia?" },
  { chave: "isolamento_acustico", texto: "As janelas têm isolamento acústico?" },
] as const;
export type ChaveRuido = (typeof PERGUNTAS_RUIDO)[number]["chave"];

export const CLASSES_RUIDO = ["baixo", "medio", "alto"] as const;
export type ClasseRuido = (typeof CLASSES_RUIDO)[number];
export const ROTULO_RUIDO: Record<ClasseRuido, string> = { baixo: "baixo", medio: "médio", alto: "alto" };

// ── Extras (item 5): fatos exibidos na ficha; nunca entram no nível ──────────────────────────────────────────────
export const EXTRAS = [
  { chave: "secador_cabelo", rotulo: "Secador de cabelo" },
  { chave: "cafeteira", rotulo: "Cafeteira (inclui espresso)" },
  { chave: "air_fryer", rotulo: "Air fryer" },
  { chave: "lava_loucas", rotulo: "Lava-louças" },
  { chave: "tv", rotulo: "TV" },
  { chave: "ferro_passar", rotulo: "Ferro de passar" },
  { chave: "tabua_passar", rotulo: "Tábua de passar" },
  { chave: "aspirador", rotulo: "Aspirador" },
  { chave: "liquidificador", rotulo: "Liquidificador" },
  { chave: "chaleira_eletrica", rotulo: "Chaleira elétrica" },
  { chave: "sanduicheira", rotulo: "Sanduicheira" },
  { chave: "varal", rotulo: "Varal" },
] as const;
export type ChaveExtra = (typeof EXTRAS)[number]["chave"];
export const CHAVES_EXTRAS: readonly ChaveExtra[] = EXTRAS.map((e) => e.chave);
export const ehChaveExtra = (v: unknown): v is ChaveExtra => typeof v === "string" && (CHAVES_EXTRAS as readonly string[]).includes(v);

// ── Medição por ponto (Prompt 57 + 59.1) ─────────────────────────────────────────────────────────────────────────
export const PONTOS_MEDICAO = ["quarto_principal", "trabalho", "sala", "outro"] as const;
export type PontoMedicao = (typeof PONTOS_MEDICAO)[number];
export const ROTULO_PONTO: Record<PontoMedicao, string> = { quarto_principal: "Quarto principal", trabalho: "Ponto de trabalho", sala: "Sala", outro: "Outro" };
export const ehPontoMedicao = (v: unknown): v is PontoMedicao => typeof v === "string" && (PONTOS_MEDICAO as readonly string[]).includes(v);

/** Peso do nível na NOTA de qualidade (Prompt 33). Não é ordem própria nem selo. */
export const PESO_NIVEL: Record<NivelOuAdequacao, number> = { em_adequacao: 0, essencial: 0, conforto: 3, premium: 6 };

/** Item da seção da entrada que confere o ruído anunciado (vira pendência como os outros). */
export const CHAVE_RUIDO_CONFERENCIA = "ruido_controlado";
export const ROTULO_RUIDO_CONFERENCIA = "O ruído confere com o anunciado";

/** Rótulo de qualquer item conferido/pendente: do padrão mínimo, do nível ou o ruído. */
export function rotuloItem(chave: string): string {
  if (chave === CHAVE_RUIDO_CONFERENCIA) return ROTULO_RUIDO_CONFERENCIA;
  if (ehChaveConforto(chave)) return itemConforto(chave).rotulo;
  if (ehChaveNivel(chave)) return itemNivel(chave).rotulo;
  return chave;
}
