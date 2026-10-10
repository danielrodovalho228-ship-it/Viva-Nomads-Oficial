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

/** O que o chat mostra de um pedido pendente (sem dado pessoal: só texto de trabalho). */
export interface CartaoAprovacao {
  id: string;
  tipo: TipoAprovacao;
  referencia: string;
  resumo: string;
  risco: "baixo" | "medio" | "alto";
  expiraEm: string;
}

/**
 * Resposta do chat a "ok/aprovo" (ordem 41ae4fc5, item 2): texto livre NUNCA aprova.
 * Com 1 cartão pendente aponta para o botão Aprovar → Confirmar; com vários, pede para escolher o cartão.
 * `null` = o chat não conseguiu ler os pedidos.
 */
export function respostaAprovacaoNoChat(pendentes: CartaoAprovacao[] | null): string {
  const regra = "Daqui do chat eu não aprovo por texto.";
  if (pendentes === null) return `${regra} A aprovação vale pelos cartões com Aprovar e Recusar (pedem confirmação e login recente).`;
  const q = textoLivreAprova(pendentes.length);
  if (q === "nada_pendente") return `${regra} Não há pedido esperando seu OK agora; quando houver, aparece um cartão com Aprovar e Recusar.`;
  if (q === "pedir_confirmacao") return `Aprovar ${pendentes[0].referencia}? Toque em Aprovar no cartão e depois em Confirmar. ${regra}`;
  return `Há ${pendentes.length} pedidos esperando seu OK. ${regra} Escolha o cartão certo e toque em Aprovar.`;
}

/** Frase para o resultado da mescla depois de aprovar um PR. */
export function rotuloMescla(m: string | undefined): string {
  switch (m) {
    case "mesclado":
      return "Aprovado e mesclado.";
    case "aguardando_token":
      return "Aprovado. Aguardando a mescla (sem token configurado).";
    case "pr_mudou":
      return "Aprovado, mas o PR mudou depois do pedido: não mesclei.";
    case "pr_nao_pronto":
      return "Aprovado, mas o PR ainda não está pronto (checks, conflito ou fechado): não mesclei.";
    case "sem_revisao_moacir":
      return "Aprovado, mas o Moacir ainda não revisou este commit: não mesclei.";
    case "falhou":
      return "Aprovado, mas a mescla falhou. Tente pelo GitHub.";
    default:
      return "Registrado.";
  }
}
