import type { SessionUser } from "../store";
import type { UserRole } from "../types";

/**
 * E793 Onda 0 — FONTE ÚNICA do mapeamento sessão/perfil → SessionUser. Usada pelo AuthProvider (cliente) e por
 * `usuarioDaSessaoServidor` (servidor). As duas pontas precisam desenhar o MESMO usuário, ou o 1º quadro do servidor e o
 * do cliente divergem (risco H4 do desenho).
 */
export interface BaseSessao {
  id: string;
  email?: string | null;
  /** user_metadata.full_name */
  metaName?: string;
  /** user_metadata.role (padrão "tenant", como no AuthProvider) */
  metaRole?: UserRole;
}

/** Linha de profiles lida (full_name, role, is_teste — preferred_mode/papel_ativo são do modo, não do usuário). */
export interface PerfilLido {
  full_name?: string | null;
  role?: string | null;
  is_teste?: boolean | null;
}

/** O usuário a partir só da sessão (antes de ler o perfil): o login nunca espera a leitura de profiles. */
export function usuarioDaSessaoBase(b: BaseSessao): SessionUser {
  return {
    id: b.id,
    name: b.metaName ?? b.email ?? "Usuário",
    fullName: b.metaName,
    email: b.email ?? "",
    role: b.metaRole ?? "tenant",
  };
}

/**
 * O usuário com o perfil lido. `perfil === null` = a linha não existe: fica a base da sessão, com isTeste false (E518:
 * nunca "carregando" para sempre). Perfil sem nome/papel cai no metadata; is_teste só é true quando é true.
 */
export function usuarioDoPerfil(b: BaseSessao, perfil: PerfilLido | null): SessionUser {
  const sessao = usuarioDaSessaoBase(b);
  if (!perfil) return { ...sessao, isTeste: false };
  return {
    id: b.id,
    name: perfil.full_name ?? b.metaName ?? b.email ?? "Usuário",
    fullName: perfil.full_name ?? b.metaName,
    email: b.email ?? "",
    role: (perfil.role as UserRole) ?? sessao.role,
    isTeste: perfil.is_teste === true,
  };
}
