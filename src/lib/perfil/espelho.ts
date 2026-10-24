/*
  CONTA-A, item 4 — O ESPELHO: o que o proprietário vê do perfil, montado enquanto a pessoa preenche. PURO.
  Roda: node --test src/lib/perfil/espelho.test.ts
*/
import type { Intencao } from "../auth/entrada.ts";

export const TITULO_ESPELHO = "É assim que o proprietário te vê";
export const PILULA_EMAIL = "E-mail confirmado";

const ROTULO: Record<Intencao, string> = { morar: "Quer morar", anunciar: "Tem imóvel", servicos: "Presta serviços" };

/** "Quer morar · Santa Mônica": a 1ª intenção e a cidade; o que faltar some (nunca um "·" sozinho). */
export function linhaIntencaoCidade(intencoes: readonly Intencao[], cidade: string | null | undefined): string {
  const partes = [intencoes[0] ? ROTULO[intencoes[0]] : "", (cidade ?? "").trim()].filter(Boolean);
  return partes.join(" · ");
}

/** Só o primeiro nome e a inicial do sobrenome, como o proprietário vê ("Ana S."). Sem nome: "Seu nome". */
export function nomeNoEspelho(nome: string | null | undefined): string {
  const p = (nome ?? "").trim().split(/\s+/).filter(Boolean);
  if (p.length === 0) return "Seu nome";
  return p.length === 1 ? p[0] : `${p[0]} ${p[p.length - 1].charAt(0).toUpperCase()}.`;
}
