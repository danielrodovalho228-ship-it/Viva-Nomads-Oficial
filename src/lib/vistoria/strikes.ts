/*
  Prompt 62-B2 (59.1 item 7) — VERIFICAÇÃO E ESCADA DE STRIKES do proprietário. PURO.
  - Strike só nasce de verificação REPROVADA ou ressalva vencida em verificação. A 1ª avaliação pedida pelo dono NUNCA
    gera strike (a ressalva vencida dela abre verificação na fila do admin; o strike, se houver, vem dessa verificação).
  - Segurança grave tira da busca na hora, FORA da contagem.
  - Escada: 1º = radar (perde "· vistoriado" no imóvel, segue publicado); 2º = aviso formal de última chance e nova
    publicação deste imóvel só com laudo aprovado; 3º = TODOS os anúncios do proprietário fora da busca até nova
    avaliação aprovada.
  - Carteira 10+ imóveis: o 3º passo exige 3 strikes no MESMO imóvel OU reprovações em 20% da carteira em 12 meses.
  - Strike contestado fica SUSPENSO (não conta, não aparece) até a 2ª avaliação. Expira e é APAGADO em 12 meses.
*/

export const STRIKE_EXPIRA_MESES = 12;
export const CARTEIRA_GRANDE = 10;
export const FRACAO_CARTEIRA_3O = 0.2;

export type OrigemStrike = "verificacao_reprovada" | "ressalva_vencida";
export type MotivoVerificacao = "denuncia_procedente" | "pendencia_conforto" | "ressalva_vencida" | "outro";

export const ROTULO_MOTIVO_VERIFICACAO: Record<MotivoVerificacao, string> = {
  denuncia_procedente: "Denúncia procedente sobre o estado do imóvel",
  pendencia_conforto: "Pendência do padrão mínimo procedente",
  ressalva_vencida: "Ressalva do laudo não corrigida no prazo",
  outro: "Outro motivo (descrito pela Viva)",
};

export interface Strike {
  propertyId: string;
  ordem: 1 | 2 | 3;
  criadoEm: string;
  /** Contestação em curso: enquanto preenchido, o strike não conta nem aparece. */
  suspenso: boolean;
  expiraEm: string;
}

export interface EventoStrike {
  origem: OrigemStrike | "avaliacao_pedida" | "seguranca_grave";
  /** A avaliação é a 1ª pedida pelo próprio dono (não uma verificação aberta pela Viva). */
  primeiraPedidaPeloDono: boolean;
}

/** Este evento gera strike? Só verificação reprovada ou ressalva vencida de verificação. */
export function geraStrike(e: EventoStrike): boolean {
  if (e.primeiraPedidaPeloDono) return false;
  return e.origem === "verificacao_reprovada" || e.origem === "ressalva_vencida";
}

export function expiraEm(criadoEm: string): string {
  const d = new Date(criadoEm);
  d.setUTCMonth(d.getUTCMonth() + STRIKE_EXPIRA_MESES);
  return d.toISOString();
}

export const strikeExpirado = (s: Pick<Strike, "expiraEm">, agora: Date) => agora >= new Date(s.expiraEm);

/** Strikes que contam: não expirados e não suspensos por contestação. */
export function strikesVigentes<T extends Pick<Strike, "expiraEm" | "suspenso">>(lista: readonly T[], agora: Date): T[] {
  return lista.filter((s) => !s.suspenso && !strikeExpirado(s, agora));
}

/** Strikes a APAGAR (inventário 58): passaram de 12 meses. */
export function strikesParaApagar<T extends Pick<Strike, "expiraEm">>(lista: readonly T[], agora: Date): T[] {
  return lista.filter((s) => strikeExpirado(s, agora));
}

export type Degrau = 0 | 1 | 2 | 3;

export interface EntradaDegrau {
  strikes: readonly Strike[];
  /** Imóveis do proprietário (publicados ou pausados) — o tamanho da carteira. */
  carteira: number;
  /** Imóveis distintos com avaliação/verificação REPROVADA nos últimos 12 meses (contados no servidor). */
  imoveisReprovados12m: number;
  agora: Date;
}

/** Degrau atual do proprietário na escada (0 = nenhum). */
export function degrauDoProprietario(e: EntradaDegrau): Degrau {
  const vig = strikesVigentes(e.strikes, e.agora);
  if (vig.length === 0) return 0;
  if (e.carteira < CARTEIRA_GRANDE) return Math.min(3, vig.length) as Degrau;
  // Carteira 10+: 3 no mesmo imóvel OU reprovações em 20% da carteira.
  const porImovel = new Map<string, number>();
  for (const s of vig) porImovel.set(s.propertyId, (porImovel.get(s.propertyId) ?? 0) + 1);
  const tresNoMesmo = [...porImovel.values()].some((n) => n >= 3);
  const vintePorCento = e.imoveisReprovados12m >= Math.ceil(e.carteira * FRACAO_CARTEIRA_3O);
  if (tresNoMesmo || vintePorCento) return 3;
  return Math.min(2, vig.length) as Degrau;
}

/** A ordem do próximo strike (1, 2 ou 3), dada a escada atual. */
export const proximaOrdem = (degrauAtual: Degrau): 1 | 2 | 3 => Math.min(3, degrauAtual + 1) as 1 | 2 | 3;

export interface ConsequenciasDegrau {
  /** O imóvel com strike perde o "· vistoriado" (nível não confirmado), mas segue publicado. */
  perdeVistoriado: boolean;
  avisoFormal: boolean;
  /** Republicar este imóvel só com laudo aprovado. */
  republicarSoComLaudo: boolean;
  /** Todos os anúncios do proprietário fora da busca até nova avaliação aprovada. */
  todosForaDaBusca: boolean;
}

export function consequencias(d: Degrau): ConsequenciasDegrau {
  return { perdeVistoriado: d >= 1, avisoFormal: d >= 2, republicarSoComLaudo: d >= 2, todosForaDaBusca: d >= 3 };
}

/** O imóvel tem strike vigente (perde o "· vistoriado")? */
export function imovelComStrike(strikes: readonly Strike[], propertyId: string, agora: Date): boolean {
  return strikesVigentes(strikes, agora).some((s) => s.propertyId === propertyId);
}

/** Texto do próximo passo para a notificação (matriz). */
export function textoDegrau(d: Degrau): string {
  switch (d) {
    case 1:
      return "Primeiro registro: o imóvel perde o \"· vistoriado\" e segue publicado.";
    case 2:
      return "Aviso formal de última chance: a nova publicação deste imóvel só volta com laudo aprovado.";
    case 3:
      return "Todos os seus anúncios saem da busca até uma nova avaliação aprovada.";
    default:
      return "";
  }
}
