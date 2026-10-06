/*
  Atendimento — classificação PURA do que a pessoa escreveu: emergência
  (193/190 primeiro), risco que vira P1 (golpe, pagamento por fora, sem acesso
  ao imóvel) e o mapa das categorias do formulário. Sem imports de servidor.
*/
import type { Prioridade, UrgenciaManutencao } from "../../config/atendimento.ts";

export type TipoChamado = "suporte" | "manutencao" | "seguranca";

export const AVISO_EMERGENCIA = "Em emergência ligue 193 (bombeiros) ou 190 (polícia).";

function normalizar(t: string): string {
  return t
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ");
}

const EMERGENCIA: { tipo: "incendio" | "gas" | "violencia"; re: RegExp }[] = [
  { tipo: "gas", re: /\b(cheiro de gas|vazamento de gas|vazando gas|gas vazando|botijao vazando)\b/ },
  { tipo: "incendio", re: /\b(incendio|pegando fogo|pegou fogo|fogo no|fumaca saindo|esta em chamas)\b/ },
  {
    tipo: "violencia",
    re: /\b(ameacad[oa]|me ameacou|ameacando|ameaca de morte|agredid[oa]|agressao|me bateu|violencia|arma de fogo|estou em perigo|socorro)\b/,
  },
];

/** Risco imediato à vida: a primeira mensagem é o 193/190. */
export function detectarEmergencia(texto: string): "incendio" | "gas" | "violencia" | null {
  const t = normalizar(texto);
  return EMERGENCIA.find((e) => e.re.test(t))?.tipo ?? null;
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
export function classificar(catKey: string, texto: string): { tipo: TipoChamado; prioridade: Prioridade; emergencia: ReturnType<typeof detectarEmergencia> } {
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
