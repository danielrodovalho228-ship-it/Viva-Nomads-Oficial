/*
  Atendimento — classificação PURA do que a pessoa escreveu: emergência
  (193/190 primeiro), risco que vira P1 (golpe, pagamento por fora, sem acesso
  ao imóvel) e o mapa das categorias do formulário. Sem imports de servidor.
*/
import type { Prioridade, UrgenciaManutencao } from "../../config/atendimento.ts";

export type TipoChamado = "suporte" | "manutencao" | "seguranca";

export const AVISO_EMERGENCIA = "Em emergência ligue 193 (bombeiros) ou 190 (polícia).";

export type Emergencia = "gas" | "incendio" | "eletrica" | "violencia" | "invasao";

function normalizar(t: string): string {
  return t
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");
}

/*
  Dicionário em texto normalizado (minúsculo, sem acento). Cuidado com falsos
  positivos: "faça" vira "faca" (por isso faca/arma só com contexto) e "é um
  roubo" (preço) não conta — só roubaram/roubou/fui roubado/roubo no imóvel.
*/
const EMERGENCIA: { tipo: Emergencia; re: RegExp }[] = [
  {
    tipo: "gas",
    re: /\bgas\b.{0,25}\b(vaz|cheir|escap)|\b(vaz|cheir|escap)\w*.{0,25}\bgas\b|\bbotijao\b.{0,20}\b(vaz|furad|escap)/,
  },
  {
    tipo: "eletrica",
    re: /\bcurto.?circuito|\bfaisc\w*|\bchoque eletrico|\b(levei|tomei|levou|tomou|dando|da) (um )?choque\b|\b(tomada|fio|fios|fiacao|disjuntor|quadro de luz)\b.{0,25}\b(derret|queiman|pegando fogo|fumaca)|\bcheiro de (fio |plastico )?queimado\b/,
  },
  {
    tipo: "incendio",
    re: /\bincendi\w*|\b(pegando|pegou|botaram|tacaram) fogo\b|\bfogo (no|na|em)\b|\bem chamas\b|\b(saiu|saindo|sai|muita|soltando|cheio de|subindo|sentindo) fumaca\b|\bfumaca (saindo|preta|da|do|no|na)\b|\bexplo(diu|dir|sao|soes)\b/,
  },
  {
    tipo: "invasao",
    re: /\barromb\w*|\binvad\w*|\binvas(ao|oes|or|ores|ora)\b|\bfurt(o|aram|ou|ad[oa]s?)\b|\b(roubaram|roubou|fui roubad[oa]|assalt\w*)|\broubo (no|na|do|da|em)\b|\b(alguem|estranhos?|desconhecid[oa]s?) (entrou|entraram|tentou entrar|tentando entrar|dentro do imovel)\b/,
  },
  {
    tipo: "violencia",
    re: /\bameac(ad[oa]s?|ou|ando|aram|a de morte)\b|\bagred\w*|\bagress(ao|oes|ivo|iva)\b|\bespanc\w*|\b(me|te|nos) (bat\w*|mat(ar|a|ou)|espanc\w*|esfaque\w*|machuc\w*)\b|\bvai (me )?(bater|matar|espancar|machucar)\b|\b(bater|matar) em mim\b|\b(com|uma|de|puxou|mostrou|sacou|pegou|apontou) (uma )?(faca|arma|revolver|pistola|facao)\b|\barma de fogo\b|\barmad[oa]\b|\bviolencia\b|\bestou em perigo\b|\bsocorro\b/,
  },
];

/** Risco imediato à vida: a primeira mensagem é o 193 ou o 190. */
export function detectarEmergencia(texto: string): Emergencia | null {
  const t = normalizar(texto);
  return EMERGENCIA.find((e) => e.re.test(t))?.tipo ?? null;
}

/** Fogo, fumaça, gás e elétrica → 193 (bombeiros); violência e invasão → 190 (polícia). */
export function numeroEmergencia(tipo: Emergencia): "193" | "190" {
  return tipo === "violencia" || tipo === "invasao" ? "190" : "193";
}

const ORIENTACAO: Record<Emergencia, string> = {
  gas: "Ligue agora para 193 (bombeiros). Saia do imóvel e não acenda luzes, fósforos ou isqueiros.",
  incendio: "Ligue agora para 193 (bombeiros). Saia do imóvel se for seguro.",
  eletrica: "Ligue agora para 193 (bombeiros). Se for seguro, desligue o disjuntor geral e não toque na fiação.",
  violencia: "Ligue agora para 190 (polícia). Vá para um lugar seguro.",
  invasao: "Ligue agora para 190 (polícia). Não entre no imóvel se alguém puder estar lá dentro.",
};

/** Primeira mensagem para quem está em emergência, com o número certo. */
export function avisoEmergencia(tipo: Emergencia | null): string {
  return tipo ? ORIENTACAO[tipo] : AVISO_EMERGENCIA;
}

const RISCO_P1: RegExp[] = [
  /\b(golpe|golpista|fraude|estelionat)/,
  /\b(pix|transferencia|deposito|pagar|pagamento)\b.{0,40}\b(direto|por fora|pra ele|para ele|pra ela|para ela|fora da plataforma)\b/,
  /\b(direto|por fora)\b.{0,30}\b(pix|pagamento|caucao|aluguel)\b/,
  /\b(trancad[oa]|nao consigo entrar|sem acesso ao imovel|ninguem atende|nao abre a porta|chave nao)\b/,
  /\b(discrimina|racis|homofob|assedi)/,
  /\b(link falso|link suspeito|site falso)\b/,
];

/** Sinais que fazem o chamado subir para P1 (pessoa na hora). */
export function detectarRiscoP1(texto: string): boolean {
  const t = normalizar(texto);
  return detectarEmergencia(texto) !== null || RISCO_P1.some((re) => re.test(t));
}

export interface CategoriaDef {
  key: string;
  rotulo: string;
  tipo: TipoChamado;
  prioridade: Prioridade;
  /** Só aparece para quem tem contrato ativo (inquilino). */
  exigeContrato?: boolean;
}

export const CATEGORIAS: CategoriaDef[] = [
  { key: "duvida", rotulo: "Dúvida sobre como usar", tipo: "suporte", prioridade: "p3" },
  { key: "anuncio", rotulo: "Meu anúncio não publica", tipo: "suporte", prioridade: "p2" },
  { key: "conta", rotulo: "Conta ou acesso", tipo: "suporte", prioridade: "p2" },
  { key: "contrato", rotulo: "Contrato ou caução", tipo: "suporte", prioridade: "p2" },
  { key: "cobranca", rotulo: "Cobrança ou assinatura", tipo: "suporte", prioridade: "p2" },
  { key: "conflito", rotulo: "Conflito com a outra parte", tipo: "suporte", prioridade: "p2" },
  { key: "manutencao", rotulo: "Manutenção no imóvel", tipo: "manutencao", prioridade: "p3", exigeContrato: true },
  { key: "seguranca", rotulo: "Segurança, golpe ou pagamento por fora", tipo: "seguranca", prioridade: "p1" },
  { key: "acesso_imovel", rotulo: "Não consigo entrar no imóvel", tipo: "seguranca", prioridade: "p1" },
  { key: "sugestao", rotulo: "Sugestão ou elogio", tipo: "suporte", prioridade: "p4" },
];

export function categoria(key: string): CategoriaDef | null {
  return CATEGORIAS.find((c) => c.key === key) ?? null;
}

/** Tipo e prioridade finais: a categoria escolhida, elevada a P1 se o texto indicar risco. */
export function classificar(catKey: string, texto: string): { tipo: TipoChamado; prioridade: Prioridade; emergencia: Emergencia | null } {
  const c = categoria(catKey) ?? categoria("duvida")!;
  const emergencia = detectarEmergencia(texto);
  if (emergencia || detectarRiscoP1(texto)) {
    return { tipo: c.tipo === "manutencao" && !emergencia ? "manutencao" : "seguranca", prioridade: "p1", emergencia };
  }
  return { tipo: c.tipo, prioridade: c.prioridade, emergencia: null };
}

/** Urgência da manutenção pelo texto (o inquilino também escolhe; vale a maior). */
export function urgenciaManutencao(texto: string, escolhida?: UrgenciaManutencao): UrgenciaManutencao {
  const t = normalizar(texto);
  const urgente = /\b(sem agua|falta de agua|sem luz|sem energia|falta de luz|vazamento|vazando|alagad|inundad|curto.circuito|cano estourou)\b/.test(t);
  if (urgente || escolhida === "urgente") return "urgente";
  return escolhida ?? "media";
}

/** "VN-000123" (o banco gera; aqui só para validar entrada). */
export function ehNumeroPublico(s: string): boolean {
  return /^VN-\d{6,}$/.test(s.trim().toUpperCase());
}
