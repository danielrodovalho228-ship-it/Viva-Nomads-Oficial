/*
  PAPEL-B — papel ativo com FONTE ÚNICA (Prompt 41, item 2). PURO.

  Conta única (14/10): o papel ativo só decide o menu e o painel que aparecem primeiro, nunca o que a pessoa pode fazer.
  Fonte: profiles.papel_ativo (morador | proprietario | parceiro; nulo = derivar do modo como antes). O selo do topo, a
  barra, o menu, o painel inicial e a Conta leem papelAtivo(); a troca é explícita (selo ou Conta) ou pela área da
  página aberta (link de e-mail, favorito, push), e sempre grava. Admin nas telas /admin é Equipe (sem troca).
*/
import { AREA_MORADOR, AREA_PARCEIRO, AREA_PROPRIETARIO } from "../../config/areas-por-papel.ts";

export const PAPEIS = ["morador", "proprietario", "parceiro"] as const;
export type Papel = (typeof PAPEIS)[number];
export type Modo = "owner" | "tenant";

export const ROTULO_PAPEL_ATIVO: Record<Papel, string> = { morador: "Morador", proprietario: "Proprietário", parceiro: "Parceiro" };

const naLista = (lista: readonly string[], pathname: string) => lista.some((p) => pathname === p || pathname.startsWith(p + "/"));

export function papelValido(v: unknown): v is Papel {
  return typeof v === "string" && (PAPEIS as readonly string[]).includes(v);
}

export function ehTelaDeAdmin(pathname: string | undefined): boolean {
  return !!pathname && (pathname === "/admin" || pathname.startsWith("/admin/"));
}

/** A área da página: o papel que ela pede, ou null (página comum: não muda o papel). */
export function papelDaRota(pathname: string | undefined, parceiroAprovado: boolean): Papel | null {
  if (!pathname) return null;
  if (naLista(AREA_PROPRIETARIO, pathname)) return "proprietario";
  if (naLista(AREA_MORADOR, pathname)) return "morador";
  if (parceiroAprovado && naLista(AREA_PARCEIRO, pathname)) return "parceiro";
  return null;
}

export function papelDoModo(modo: Modo): Papel {
  return modo === "owner" ? "proprietario" : "morador";
}

/** Morador e proprietário têm modo próprio; parceiro mantém o modo de antes por baixo. */
export function modoDoPapel(papel: Papel): Modo | null {
  return papel === "proprietario" ? "owner" : papel === "morador" ? "tenant" : null;
}

/**
 * O papel ativo. Ordem: admin numa tela /admin → null (Equipe); a área da página aberta; a escolha de parceiro (só com a
 * parceria aprovada); o modo (proprietário/morador, que já vem da escolha gravada).
 */
export function papelAtivo(p: { admin: boolean; modo: Modo; parceiroEscolhido: boolean; parceiroAprovado: boolean; pathname?: string }): Papel | null {
  if (p.admin && (!p.pathname || ehTelaDeAdmin(p.pathname))) return null;
  const area = papelDaRota(p.pathname, p.parceiroAprovado);
  if (area) return area;
  if (p.parceiroEscolhido && p.parceiroAprovado) return "parceiro";
  return papelDoModo(p.modo);
}

/** O papel gravado no perfil → estado da sessão (modo + parceiro). Nulo/inválido: deriva como antes (modo atual). */
export function estadoDoPapelGravado(gravado: unknown, modoAtual: Modo): { modo: Modo; parceiro: boolean } {
  if (!papelValido(gravado)) return { modo: modoAtual, parceiro: false };
  if (gravado === "parceiro") return { modo: modoAtual, parceiro: true };
  return { modo: modoDoPapel(gravado)!, parceiro: false };
}

/** Os papéis para os quais dá para trocar: os que a pessoa tem, menos o ativo. */
export function opcoesDeTroca(ativo: Papel | null, papeisQueTem: Papel[]): Papel[] {
  return PAPEIS.filter((p) => papeisQueTem.includes(p) && p !== ativo);
}

/** O painel de cada papel (para onde a troca leva). */
export function painelDoPapel(papel: Papel): string {
  return papel === "parceiro" ? "/dashboard/parceiro" : "/dashboard";
}

/** Precisa gravar? A página pede um papel diferente do que está escolhido. */
export function trocaPelaArea(area: Papel | null, escolhido: Papel | null): Papel | null {
  return area && area !== escolhido ? area : null;
}
