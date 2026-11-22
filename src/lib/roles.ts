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

import { usePathname } from "next/navigation";
import { useAuthStore, DEMO_USER, type SessionUser, type ViewMode } from "./store";
import { modoDaRota } from "./papel/modo-da-rota";
import { useModoAtual, useSessaoServidor, useUsuarioAtual } from "@/components/auth/sessao-servidor-contexto";
import { nomeParaAvatar, primeiroNome, usuarioDoEmail } from "./display-name";

export type { ViewMode };

/**
 * Papéis efetivos da conta. Prompt 43 (conta única, papéis em camadas): toda conta é Morador e pode virar
 * Proprietário a qualquer momento (o convite "Anunciar um imóvel" leva às telas de dono). Por isso o contexto da tela
 * decide o modo — abrir uma tela de dono ou de morador troca o modo, nunca expulsa. Flags explícitas ainda valem.
 */
export function rolesOf(user: SessionUser): { isOwner: boolean; isTenant: boolean } {
  const isOwner = user.isOwner ?? true;
  const isTenant = user.isTenant ?? true;
  return { isOwner, isTenant };
}

/** Modo padrão da conta: segue o papel de cadastro (admin entra como proprietário). */
export function defaultMode(user: SessionUser): ViewMode {
  return user.role === "tenant" ? "tenant" : "owner";
}

/**
 * FONTE ÚNICA do nome exibido do próprio usuário (QA item 5 + ADENDO item 3).
 * Fina camada sobre `primeiroNome` (lib/display-name — server+client), aplicada
 * ao `SessionUser`:
 *  • origem = `profiles.full_name` (chega em `SessionUser.fullName`);
 *  • devolve o PRIMEIRO nome; sem nome (ou valor com "@"), devolve "" e a UI cai
 *    num rótulo neutro ("Olá!" na saudação, "Minha conta" no rodapé);
 *  • NUNCA o e-mail cru — a rejeição de "@" mora em `primeiroNome`, na fonte, e
 *    não em cada tela (o `SessionUser.name` tem o e-mail como fallback do
 *    AuthProvider — por isso `name` não deve ir direto para a tela);
 *  • NUNCA uma persona de demonstração em conta real (a persona só entra via
 *    `useDisplayUser`, que só devolve DEMO_USER com o modo demo ligado).
 * Todo lugar que mostra o nome do próprio usuário DEVE passar por aqui.
 */
export function primeiroNomeExibicao(user: SessionUser | null | undefined): string {
  return primeiroNome(user?.fullName);
}

/** E788: o nome do AVATAR da própria conta — o completo, como no Perfil (iniciais iguais em toda superfície). */
export function nomeAvatarExibicao(user: SessionUser | null | undefined): string {
  return nomeParaAvatar(user?.fullName);
}

/**
 * Identidade curta do PRÓPRIO usuário para o rodapé/avatar: primeiro nome do
 * perfil; sem nome, o "usuário" do e-mail (parte antes do @) — que identifica
 * sem expor o e-mail inteiro; em último caso, rótulo neutro. Fonte única do
 * rótulo do rodapé da casca.
 */
export function identidadeUsuario(user: SessionUser | null | undefined): string {
  return primeiroNomeExibicao(user) || usuarioDoEmail(user?.email) || "Minha conta";
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
  // E793 (A4): com a sessão do servidor (painel), usuário e modo vêm dos hooks do quadro — o 1º quadro do servidor e o da
  // hidratação desenham o MESMO usuário/modo. Sem ela (site público, chave off), é o store, como antes.
  const sessao = useSessaoServidor();
  const usuarioDoQuadro = useUsuarioAtual();
  const modoDoQuadro = useModoAtual();
  const storeUser = useAuthStore((s) => s.user);
  const storeMode = useAuthStore((s) => s.activeMode);
  const user = (sessao ? usuarioDoQuadro : storeUser) ?? DEMO_USER;
  const activeMode = sessao ? modoDoQuadro : storeMode;
  // E497: página de área (ex.: /dashboard/leads) decide o modo pela URL já no 1º render — servidor e cliente iguais,
  // sem o menu/título trocarem depois da pintura quando o SincronizarPapel grava o papel da área.
  const daArea = modoDaRota(usePathname());
  const { isOwner, isTenant } = rolesOf(user);
  return {
    mode: daArea ?? resolveMode(user, activeMode),
    isOwner,
    isTenant,
    hasBoth: isOwner && isTenant,
  };
}
