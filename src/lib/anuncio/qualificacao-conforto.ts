/*
  E132-A — QUALIFICAÇÃO COMO ETAPA PRÓPRIA (mockups qualificacao-01/02). PURO.

  Antes do Passo 1 do cadastro NOVO: 5 telas que cobrem EXATAMENTE os 12 itens do essencial (ITENS_CONFORTO,
  src/config/conforto-minimo.ts) — nunca uma lista própria. As respostas viram as MESMAS confirmações de conforto e as
  mesmas comodidades que o Passo 5 grava (fonte única: o Passo 5 abre com elas marcadas).
  Sim/não = toggle (padrão E56, adendo do coordenador); várias opções = cartões (como no mockup).
  Resultado (decisão do Muse, 25/10): nível REAL (o motor calcula Essencial com 12/12), nunca "estimado"; abaixo, a lista
  "Para subir a Conforto", tirada da matriz dos níveis.
*/
import { CHAVES_CONFORTO, itemConforto, type ChaveConforto } from "../../config/conforto-minimo.ts";
import { MATRIZ, itemNivel, type ChaveNivel } from "../../config/niveis.ts";

export type IconeOpcao =
  | "ar" | "ventilador" | "nao" | "fogao" | "micro" | "forno" | "roupa" | "cama" | "maquina" | "predio";

export interface OpcaoCartao {
  id: string;
  rotulo: string;
  icone: IconeOpcao;
  /** Itens do essencial que esta resposta cumpre. */
  cumpre: readonly ChaveConforto[];
  /** Comodidades do anúncio que esta resposta marca (as mesmas do Passo 5). */
  comodidades?: readonly string[];
}

export type Pergunta =
  | { id: string; tipo: "toggle"; rotulo: string; chave: ChaveConforto }
  | { id: string; tipo: "cartoes"; rotulo: string; chave: ChaveConforto; opcoes: readonly OpcaoCartao[] }
  | { id: string; tipo: "internet"; rotulo: string; chave: "internet_informada" };

export interface TelaQualificacao {
  id: string;
  titulo: string;
  perguntas: readonly Pergunta[];
}

const NAO: Pick<OpcaoCartao, "icone" | "cumpre"> = { icone: "nao", cumpre: [] };

export const TELAS_QUALIFICACAO: readonly TelaQualificacao[] = [
  {
    id: "quarto",
    titulo: "Quarto",
    perguntas: [
      { id: "cama", tipo: "toggle", rotulo: "Cama com colchão em bom estado para cada ocupante", chave: "cama_colchao" },
      { id: "apoio", tipo: "toggle", rotulo: "Junto a cada cama: apoio, luz de leitura e tomada", chave: "apoio_cama" },
      {
        id: "ventilacao",
        tipo: "cartoes",
        rotulo: "Cada quarto tem:",
        chave: "ventilacao_quartos",
        opcoes: [
          { id: "ar", rotulo: "Ar-condicionado em todos", icone: "ar", cumpre: ["ventilacao_quartos"], comodidades: ["ar_condicionado"] },
          { id: "ventilacao", rotulo: "Ventilador ou janela em todos", icone: "ventilador", cumpre: ["ventilacao_quartos"] },
          { id: "nao", rotulo: "Nem todos os quartos", ...NAO },
        ],
      },
    ],
  },
  {
    id: "cozinha-roupa",
    titulo: "Cozinha e roupa",
    perguntas: [
      {
        id: "cozinha",
        tipo: "cartoes",
        rotulo: "A cozinha tem:",
        chave: "cozinha_basica",
        opcoes: [
          { id: "fogao", rotulo: "Fogão e geladeira", icone: "fogao", cumpre: ["cozinha_basica"] },
          { id: "micro", rotulo: "Fogão, geladeira e micro-ondas", icone: "micro", cumpre: ["cozinha_basica"] },
          { id: "completa", rotulo: "Cozinha completa com forno", icone: "forno", cumpre: ["cozinha_basica"], comodidades: ["cozinha_equipada"] },
        ],
      },
      {
        id: "roupa",
        tipo: "cartoes",
        rotulo: "Roupa de cama e toalhas:",
        chave: "roupa_cama_banho",
        opcoes: [
          { id: "todos", rotulo: "Sim, para todos", icone: "roupa", cumpre: ["roupa_cama_banho"], comodidades: ["enxoval"] },
          { id: "so-cama", rotulo: "Só roupa de cama", icone: "cama", cumpre: [] },
          { id: "nao", rotulo: "Não tem", ...NAO },
        ],
      },
    ],
  },
  {
    id: "banho-lavanderia",
    titulo: "Banho e lavanderia",
    perguntas: [
      { id: "agua", tipo: "toggle", rotulo: "Água quente no chuveiro", chave: "agua_quente" },
      {
        id: "lavanderia",
        tipo: "cartoes",
        rotulo: "Máquina de lavar:",
        chave: "lavanderia_acesso",
        opcoes: [
          { id: "imovel", rotulo: "No imóvel", icone: "maquina", cumpre: ["lavanderia_acesso"], comodidades: ["maquina_lavar"] },
          { id: "predio", rotulo: "No prédio ou condomínio, com uso incluído", icone: "predio", cumpre: ["lavanderia_acesso"] },
          { id: "nao", rotulo: "Não tem", ...NAO },
        ],
      },
    ],
  },
  {
    id: "casa",
    titulo: "A casa",
    perguntas: [
      { id: "luz", tipo: "toggle", rotulo: "Luz funcionando em todos os cômodos", chave: "iluminacao" },
      { id: "fechadura", tipo: "toggle", rotulo: "Porta de entrada com fechadura funcionando", chave: "fechadura_entrada" },
      { id: "limpa", tipo: "toggle", rotulo: "Imóvel limpo e pronto para morar na entrada", chave: "entrega_limpa" },
      { id: "mobilia", tipo: "toggle", rotulo: "A mobília das fotos está no imóvel", chave: "mobilia_das_fotos" },
    ],
  },
  {
    id: "internet",
    titulo: "Internet",
    perguntas: [{ id: "internet", tipo: "internet", rotulo: "Qual a velocidade da internet do imóvel?", chave: "internet_informada" }],
  },
];

export const TOTAL_TELAS = TELAS_QUALIFICACAO.length;

/** Resposta de cada pergunta: toggle → true/false; cartões → id da opção; internet → Mbps (texto) ou "nao_tem". */
export type Respostas = Record<string, string | boolean>;

export const SEM_INTERNET_QUALIFICACAO = "nao_tem";

/** O critério de cada item ("O que conta?"), lido da lista única. */
export const criterioDe = (chave: ChaveConforto) => itemConforto(chave).criterio;

/** Todas as chaves que as 5 telas cobrem (o teste confere que são exatamente CHAVES_CONFORTO). */
export function chavesCobertas(): ChaveConforto[] {
  return TELAS_QUALIFICACAO.flatMap((t) => t.perguntas.map((p) => p.chave));
}

/** As respostas → confirmações de conforto, comodidades e a velocidade da internet (o que o Passo 5 grava). */
export function aplicarRespostas(r: Respostas): { conforto: ChaveConforto[]; comodidades: string[]; internetMbps: string | null; semInternet: boolean } {
  const conforto = new Set<ChaveConforto>();
  const comodidades = new Set<string>();
  let internetMbps: string | null = null;
  let semInternet = false;
  for (const tela of TELAS_QUALIFICACAO) {
    for (const p of tela.perguntas) {
      const v = r[p.id];
      if (p.tipo === "toggle") {
        if (v === true) conforto.add(p.chave);
      } else if (p.tipo === "cartoes") {
        const op = p.opcoes.find((o) => o.id === v);
        op?.cumpre.forEach((c) => conforto.add(c));
        op?.comodidades?.forEach((c) => comodidades.add(c));
      } else if (v === SEM_INTERNET_QUALIFICACAO) {
        semInternet = true;
      } else if (typeof v === "string" && Number(v) > 0) {
        internetMbps = String(Math.round(Number(v)));
        conforto.add("internet_informada");
      }
    }
  }
  return { conforto: CHAVES_CONFORTO.filter((c) => conforto.has(c)), comodidades: [...comodidades], internetMbps, semInternet };
}

/** Os itens do essencial que faltam (na ordem da lista única). */
export const faltamDoEssencial = (conforto: readonly string[]) => CHAVES_CONFORTO.filter((c) => !conforto.includes(c));

/** Título do Resultado pela situação real — NUNCA "já pode anunciar" com item faltando (correção do coordenador). */
export function tituloResultado(faltam: number): { titulo: string; subtitulo: string } {
  if (faltam === 0) return { titulo: "Seu imóvel tem o essencial da Viva", subtitulo: "Ele cumpre os 12 itens do essencial." };
  return {
    titulo: `Faltam ${faltam} ${faltam === 1 ? "item" : "itens"} do essencial para publicar`,
    subtitulo: "Você pode começar o cadastro agora e resolver até publicar.",
  };
}

/**
 * O nível que o motor dá agora (decisão do Muse: o real, nunca estimado): com os 12 itens, Essencial; sem eles, ainda
 * sem nível (não publica). E os itens a MAIS do Conforto, da matriz dos níveis, para a lista "Para subir a Conforto".
 */
export function nivelDoResultado(conforto: readonly string[], respostas: Respostas = {}): { nivel: "Essencial" | null; paraSubir: string[] } {
  const jaTem = new Set(jaTemDoConforto(respostas));
  const paraSubir = [...new Set(Object.values(MATRIZ).flatMap((a) => a.conforto as readonly ChaveNivel[]))].filter((c) => !jaTem.has(c)).map((c) => itemNivel(c).rotulo);
  return { nivel: faltamDoEssencial(conforto).length === 0 ? "Essencial" : null, paraSubir };
}

/**
 * E179: itens do Conforto que as respostas já mostram que o imóvel tem — saem da lista "Para subir a Conforto" (pedir o
 * que já existe confunde). Só o que a resposta diz sem dúvida: a cozinha com micro-ondas (a opção "completa" vem acima
 * dela na escala), ar-condicionado em todos os quartos (inclui o principal) e a máquina de lavar no imóvel. A foto na
 * hora continua valendo no cadastro, como para todo item do nível.
 */
const CONFORTO_PELAS_RESPOSTAS: readonly { pergunta: string; opcoes: readonly string[]; item: ChaveNivel }[] = [
  { pergunta: "cozinha", opcoes: ["micro", "completa"], item: "cozinha_microondas" },
  { pergunta: "ventilacao", opcoes: ["ar"], item: "ar_quarto_principal" },
  { pergunta: "lavanderia", opcoes: ["imovel"], item: "lavadora_no_imovel" },
];

export function jaTemDoConforto(r: Respostas): ChaveNivel[] {
  return CONFORTO_PELAS_RESPOSTAS.filter((x) => typeof r[x.pergunta] === "string" && x.opcoes.includes(r[x.pergunta] as string)).map((x) => x.item);
}

/** Estado da Qualificação no rascunho (dados do rascunho, sem coluna nova). */
export interface EstadoQualificacao {
  status: "pendente" | "respondida" | "pulada";
  respostas: Respostas;
}

export function estadoDoRascunho(v: unknown): EstadoQualificacao | null {
  if (!v || typeof v !== "object") return null;
  const o = v as { status?: unknown; respostas?: unknown };
  if (o.status !== "pendente" && o.status !== "respondida" && o.status !== "pulada") return null;
  const respostas: Respostas = {};
  if (o.respostas && typeof o.respostas === "object") {
    for (const [k, val] of Object.entries(o.respostas as Record<string, unknown>)) if (typeof val === "string" || typeof val === "boolean") respostas[k] = val;
  }
  return { status: o.status, respostas };
}

/** As comodidades que alguma resposta da Qualificação pode marcar (para desmarcar as que a resposta nova não marca). */
export const COMODIDADES_DA_QUALIFICACAO: readonly string[] = [
  ...new Set(TELAS_QUALIFICACAO.flatMap((t) => t.perguntas.flatMap((p) => (p.tipo === "cartoes" ? p.opcoes.flatMap((o) => o.comodidades ?? []) : [])))),
];
