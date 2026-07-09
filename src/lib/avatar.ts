/**
 * Foto de perfil — REGRAS PURAS e testáveis (sem I/O). A visibilidade da foto
 * do INQUILINO é aplicada no BACKEND (a rota/URL assinada só é emitida quando
 * `podeVerAvatar` devolve true); o front nunca é a trava.
 *
 * Decisões dos sócios embutidas:
 *  - Proprietário: foto pública (oferece serviço; rosto gera confiança).
 *  - Inquilino: foto só depois de ACEITE MÚTUO — a decisão nunca se baseia na
 *    aparência. Antes do aceite: só iniciais.
 *  - Sempre opcional: padrão é o avatar de iniciais (cor determinística por nome).
 *  - PROIBIDO reusar imagem da verificação (CAF): dado biométrico, finalidade única.
 */

export type Papel = "owner" | "tenant" | "admin";

/**
 * Estados de relação entre inquilino e proprietário que LIBERAM a foto do
 * inquilino (Fase 3.2). Espelha a "revelação do nome só após aceite" que já
 * existe no Pedido de Moradia (resposta `aceita_para_conversa`).
 */
export const ESTADOS_ACEITOS = [
  "aceita_para_conversa", // resposta a pedido de moradia aceita pelo inquilino
  "aceito", // candidatura/documento aceito
  "assinado", // contrato assinado
  "contrato", // existe contrato entre as partes
] as const;

export type EstadoRelacao = string | null | undefined;

export function relacaoAceita(estado: EstadoRelacao): boolean {
  return !!estado && (ESTADOS_ACEITOS as readonly string[]).includes(estado);
}

export interface CtxVisibilidade {
  viewerId: string; // quem está olhando
  targetId: string; // dono da foto
  targetPapel: Papel; // papel do dono da foto (na relação)
  viewerIsAdmin?: boolean;
  /** Estado da relação viewer↔target (candidatura/pedido/contrato). */
  estadoRelacao?: EstadoRelacao;
}

/**
 * A foto do `target` pode ser exibida para o `viewer`?
 *  - o próprio dono SEMPRE vê a própria foto;
 *  - admin vê tudo (moderação);
 *  - foto de PROPRIETÁRIO é pública;
 *  - foto de INQUILINO só com relação em estado ACEITO.
 */
export function podeVerAvatar(ctx: CtxVisibilidade): boolean {
  if (ctx.viewerId && ctx.viewerId === ctx.targetId) return true; // eu mesmo
  if (ctx.viewerIsAdmin) return true; // moderação
  if (ctx.targetPapel === "owner") return true; // proprietário é público
  if (ctx.targetPapel === "tenant") return relacaoAceita(ctx.estadoRelacao);
  return false;
}

/** Iniciais determinísticas (até 2) a partir do nome. */
export function iniciais(nome: string): string {
  const parts = (nome || "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const first = parts[0].charAt(0);
  const last = parts.length > 1 ? parts[parts.length - 1].charAt(0) : "";
  return (first + last).toUpperCase() || "?";
}

/** Paleta de fundos (escuros o bastante p/ iniciais brancas legíveis). */
export const AVATAR_PALETTE = [
  "#143c8c", // azul (primária)
  "#1e63d0", // azul médio
  "#0b2a66", // azul escuro
  "#2f6310", // verde escuro
  "#4fa01e", // verde médio
  "#5b6573", // slate
] as const;

/** Hash estável (djb2) → índice na paleta. Mesma pessoa, mesma cor sempre. */
export function corAvatar(nome: string): string {
  const s = (nome || "").trim().toLowerCase();
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return AVATAR_PALETTE[h % AVATAR_PALETTE.length];
}
