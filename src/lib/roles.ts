"use client";

/**
 * Papéis e modo ativo (rodada 19) — inquilino ⇄ proprietário.
 *
 * A mesma conta pode ter os dois papéis. `ViewMode` é o "mundo" em que o usuário
 * navega agora; é separado do `role` de cadastro, que segue governando as
 * permissões reais. Aqui ficam as regras puras de derivação (quais papéis a
 * conta tem, qual o modo padrão, qual o modo efetivo) e os metadados de UI
 * (rótulo e acento de cor por modo), além do hook `useViewMode`.
 */

import { useAuthStore, DEMO_USER, type SessionUser, type ViewMode } from "./store";

export type { ViewMode };

/** Papéis efetivos da conta. Sem flags explícitas, derivam-se do `role`. */
export function rolesOf(user: SessionUser): { isOwner: boolean; isTenant: boolean } {
  const isOwner = user.isOwner ?? (user.role === "owner" || user.role === "admin");
  const isTenant = user.isTenant ?? user.role === "tenant";
  return { isOwner, isTenant };
}

/** Modo padrão da conta: segue o papel de cadastro (admin entra como proprietário). */
export function defaultMode(user: SessionUser): ViewMode {
  return user.role === "tenant" ? "tenant" : "owner";
}

/**
 * FONTE ÚNICA do nome exibido do próprio usuário (QA item 5). Regra definitiva:
 *  • origem = `profiles.full_name` (chega em `SessionUser.fullName`);
 *  • devolve o PRIMEIRO nome; sem nome coletado, devolve "" e a UI cai num
 *    rótulo neutro ("Olá!" na saudação, "Minha conta" no rodapé);
 *  • NUNCA o e-mail cru (o `SessionUser.name` tem o e-mail como fallback do
 *    AuthProvider — por isso `name` não deve ir direto para a tela);
 *  • NUNCA uma persona de demonstração em conta real (a persona só entra via
 *    `useDisplayUser`, que só devolve DEMO_USER com o modo demo ligado).
 * Todo lugar que mostra o nome do próprio usuário DEVE passar por aqui.
 */
export function primeiroNomeExibicao(user: SessionUser | null | undefined): string {
  const full = user?.fullName?.trim();
  return full ? full.split(" ")[0] : "";
}

/**
 * Modo efetivo: respeita a escolha do usuário (`activeMode`). Qualquer conta pode
 * transitar entre os dois mundos (proprietário ⇄ inquilino) — o `activeMode` é
 * persistido, então a escolha sobrevive a recarregamentos. Sem escolha, cai no
 * modo padrão do papel de cadastro.
 */
export function resolveMode(user: SessionUser, activeMode: ViewMode | null): ViewMode {
  if (activeMode === "owner" || activeMode === "tenant") return activeMode;
  return defaultMode(user);
}

/** Rótulo e acento de cor por modo (acento sutil, sem trocar a identidade). */
export const MODE_META: Record<
  ViewMode,
  { label: string; accentText: string; accentDot: string; accentBg: string; other: ViewMode }
> = {
  // Proprietário = verde (champagne); inquilino = azul (primária).
  owner: { label: "Proprietário", accentText: "text-champagne-600", accentDot: "bg-champagne", accentBg: "bg-champagne/15", other: "tenant" },
  tenant: { label: "Inquilino", accentText: "text-blue-500", accentDot: "bg-blue-500", accentBg: "bg-blue-50", other: "owner" },
};

export interface ViewModeState {
  mode: ViewMode;
  isOwner: boolean;
  isTenant: boolean;
  hasBoth: boolean;
}

/**
 * Hook central do modo ativo. Lê o usuário (ou a identidade demo) e o
 * `activeMode` persistido, e devolve o modo efetivo + os papéis da conta.
 */
export function useViewMode(): ViewModeState {
  const user = useAuthStore((s) => s.user) ?? DEMO_USER;
  const activeMode = useAuthStore((s) => s.activeMode);
  const { isOwner, isTenant } = rolesOf(user);
  return {
    mode: resolveMode(user, activeMode),
    isOwner,
    isTenant,
    hasBoth: isOwner && isTenant,
  };
}
