/*
  Regras das APROVAÇÕES pelo chat do Moacir (ordem 41ae4fc5, parte 1). Puro: sem banco, sem rede.
  A rota (parte 2) chama estas funções ANTES de gravar; a tabela public.aprovacoes (0095) guarda o resultado.
*/

export type TipoAprovacao = "merge_pr" | "migracao" | "decisao" | "documento";
export type StatusAprovacao = "pendente" | "aprovada" | "recusada" | "expirada";

export interface Aprovacao {
  tipo: TipoAprovacao;
  status: StatusAprovacao;
  expiraEm: Date;
  /** Hash do conteúdo aprovado (para merge_pr: SHA do último commit). */
  hashConteudo: string | null;
}

export interface ContextoDecisao {
  agora: Date;
  ehAdmin: boolean;
  /** Último login do admin (auth.users.last_sign_in_at). */
  ultimoLoginEm: Date | null;
  /** O admin tocou em "Confirmar" no segundo passo. */
  confirmou: boolean;
}

export const SESSAO_RECENTE_MIN = 15;

export type Motivo = "nao_admin" | "ja_decidida" | "expirada" | "sem_confirmacao" | "sessao_antiga";

export type Veredito = { ok: true } | { ok: false; motivo: Motivo; http: 403 | 409 | 410 | 428 | 401 };

/** Decide se o admin pode aprovar/recusar agora. Recusar não exige sessão recente nem confirmação. */
export function podeDecidir(a: Aprovacao, c: ContextoDecisao, acao: "aprovar" | "recusar"): Veredito {
  if (!c.ehAdmin) return { ok: false, motivo: "nao_admin", http: 403 };
  if (a.status !== "pendente") return { ok: false, motivo: "ja_decidida", http: 409 };
  if (a.expiraEm.getTime() <= c.agora.getTime()) return { ok: false, motivo: "expirada", http: 410 };
  if (acao === "recusar") return { ok: true };
  if (!c.confirmou) return { ok: false, motivo: "sem_confirmacao", http: 428 };
  const limite = SESSAO_RECENTE_MIN * 60_000;
  if (!c.ultimoLoginEm || c.agora.getTime() - c.ultimoLoginEm.getTime() > limite) return { ok: false, motivo: "sessao_antiga", http: 401 };
  return { ok: true };
}

/** Mescla só se o commit atual do PR for exatamente o que o Daniel aprovou. */
export function hashConfere(aprovado: string | null, atual: string): boolean {
  if (!aprovado || !atual) return false;
  const a = aprovado.toLowerCase();
  const b = atual.toLowerCase();
  return a.length >= 7 && (a === b || (a.length < b.length && b.startsWith(a)));
}

/** "ok/aprovo" em texto livre só vale com exatamente 1 cartão pendente — e mesmo assim só leva ao botão Confirmar. */
export function textoLivreAprova(pendentes: number): "pedir_confirmacao" | "mostrar_cartoes" | "nada_pendente" {
  if (pendentes === 1) return "pedir_confirmacao";
  return pendentes === 0 ? "nada_pendente" : "mostrar_cartoes";
}

/** Uma aprovação vale para os agentes (Moacir/Renato) só se aprovada e dentro do prazo. */
export function valeComoOkDoDaniel(a: Aprovacao, agora: Date): boolean {
  return a.status === "aprovada" && a.expiraEm.getTime() > agora.getTime();
}
