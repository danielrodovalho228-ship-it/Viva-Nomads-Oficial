/*
  64-B — pausar e reativar anúncio pelo dono, e o limite do plano numa conta só. PURO.

  O motivo da pausa (properties.pausa_motivo) decide quem pode reativar: só o que o DONO pausou volta pelo botão
  "Reativar" (e pela mesma porta da publicação). Pausa da Viva (padrão mínimo, câmera, admin, avaliação, conta pausada)
  mostra o motivo e o caminho, nunca o botão. Anúncios acima do limite do plano não saem do ar sozinhos: o limite só
  barra quem PASSA a publicado.
*/
import { LIMITE_ANUNCIOS, type PlanoId } from "../../config/planos.ts";

export const MOTIVOS_PAUSA = ["dono", "conforto", "camera", "admin", "avaliacao", "conta"] as const;
export type MotivoPausa = (typeof MOTIVOS_PAUSA)[number];

export function motivoPausaValido(v: unknown): v is MotivoPausa {
  return typeof v === "string" && (MOTIVOS_PAUSA as readonly string[]).includes(v);
}

/** Só o que o dono pausou ele mesmo reativa. */
export function donoPodeReativar(motivo: string | null | undefined): boolean {
  return motivo === "dono";
}

/** O que a tela mostra para cada pausa: o motivo e o caminho (pausa da Viva nunca tem botão de reativar). */
export const PAUSA_TEXTO: Record<MotivoPausa, { motivo: string; caminho: { rotulo: string; href: string } | null }> = {
  dono: { motivo: "Você pausou este anúncio.", caminho: null },
  conforto: { motivo: "Pausado pela Viva: o padrão mínimo de conforto venceu.", caminho: { rotulo: "Confirme o padrão mínimo", href: "/dashboard/imoveis" } },
  camera: { motivo: "Pausado pela Viva para conferir a declaração de câmeras.", caminho: { rotulo: "Fale com a Viva", href: "/dashboard/conta/ajuda" } },
  admin: { motivo: "Pausado pela Viva.", caminho: { rotulo: "Fale com a Viva", href: "/dashboard/conta/ajuda" } },
  avaliacao: { motivo: "Pausado pela Viva depois da avaliação do imóvel.", caminho: { rotulo: "Fale com a Viva", href: "/dashboard/conta/ajuda" } },
  conta: { motivo: "Sua conta está pausada: o anúncio volta quando você reativar a conta.", caminho: { rotulo: "Reativar minha conta", href: "/dashboard" } },
};

export function textoDaPausa(motivo: string | null | undefined): { motivo: string; caminho: { rotulo: string; href: string } | null } {
  return motivoPausaValido(motivo) ? PAUSA_TEXTO[motivo] : PAUSA_TEXTO.admin;
}

export function limiteDoPlano(plano: string | null | undefined): number {
  return LIMITE_ANUNCIOS[(plano ?? "free") as PlanoId] ?? LIMITE_ANUNCIOS.free;
}

export interface SituacaoLimite {
  limite: number;
  ativos: number;
  /** Quantos estão acima do limite (0 se cabe). */
  excedente: number;
  /** Cabe mais um publicado? */
  podePublicarNovo: boolean;
  /** Quantos pausar para publicar MAIS UM (0 se já cabe). */
  precisaPausar: number;
}

/** A conta única do limite: o painel, a prontidão e o servidor leem daqui. */
export function situacaoLimite(plano: string | null | undefined, ativos: number): SituacaoLimite {
  return situacaoComLimite(limiteDoPlano(plano), ativos);
}

/** A mesma conta, quando o limite já vem lido (prontidão). */
export function situacaoComLimite(limiteBruto: number, ativos: number): SituacaoLimite {
  const limite = Math.max(0, Math.floor(limiteBruto));
  const n = Math.max(0, Math.floor(ativos));
  return {
    limite,
    ativos: n,
    excedente: Math.max(0, n - limite),
    podePublicarNovo: n < limite,
    precisaPausar: Math.max(0, n - limite + 1),
  };
}

const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

/** Bloqueio ao publicar um anúncio novo (sem ponto final: a prontidão junta os itens com "; "). */
export function mensagemLimitePublicar(s: SituacaoLimite): string {
  return `Seu plano permite ${plural(s.limite, "anúncio publicado", "anúncios publicados")} e você tem ${s.ativos}. Para publicar este, pause ${plural(s.precisaPausar, "anúncio", "anúncios")} ou mude de plano`;
}

/** Bloqueio ao reativar (a conta de ativos já vem SEM o anúncio que se quer reativar). */
export function mensagemLimiteReativar(s: SituacaoLimite): string {
  return `Seu plano permite ${plural(s.limite, "publicado", "publicados")} e você tem ${s.ativos}. Para reativar, pause ${plural(s.precisaPausar, "anúncio", "anúncios")} ou mude de plano.`;
}

/** A linha do painel: "M publicados — seu plano permite N" e, acima do limite, o que fazer. */
export function linhasDoLimite(s: SituacaoLimite): string[] {
  const linhas = [`${plural(s.ativos, "publicado", "publicados")} — seu plano permite ${s.limite}`];
  if (s.ativos > s.limite) linhas.push(`Os que já estavam publicados continuam. Para publicar outro, pause ${plural(s.precisaPausar, "anúncio", "anúncios")} ou mude de plano.`);
  return linhas;
}

/** O que está em andamento num anúncio e continua depois da pausa (a tela lista antes de confirmar). */
export interface EmAndamento {
  candidaturasAbertas: number;
  propostasAceitas: number;
  visitasMarcadas: number;
  contratosVigentes: number;
}

export function textoEmAndamento(e: EmAndamento): string[] {
  const t: string[] = [];
  if (e.contratosVigentes) t.push(`${plural(e.contratosVigentes, "contrato vigente continua", "contratos vigentes continuam")} sem mudança.`);
  if (e.propostasAceitas) t.push(`${plural(e.propostasAceitas, "proposta aceita continua", "propostas aceitas continuam")}.`);
  if (e.visitasMarcadas) t.push(`${plural(e.visitasMarcadas, "visita marcada continua", "visitas marcadas continuam")}.`);
  if (e.candidaturasAbertas) t.push(`${plural(e.candidaturasAbertas, "candidatura aberta continua", "candidaturas abertas continuam")}; você pode responder a ${e.candidaturasAbertas === 1 ? "ela" : "elas"}.`);
  return t;
}
