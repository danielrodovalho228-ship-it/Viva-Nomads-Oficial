/**
 * LOGIN-APPLE — quais botões de login social a entrada mostra. Parte PURA (sem process.env): a página passa as flags
 * LOGIN_GOOGLE_ATIVO e LOGIN_APPLE_ATIVO (src/lib/flags.ts), e o teste passa ligado/desligado.
 *
 * - Flag da Apple desligada (o padrão; NEXT_PUBLIC_LOGIN_APPLE_ATIVO não existe na Vercel): a lista é a de hoje.
 * - Flag ligada: "Continuar com a Apple" vem PRIMEIRO. A Apple pede destaque igual ou maior que o dos outros
 *   provedores (App Review 4.8 e Human Interface Guidelines), por isso o botão é preto, com a maçã e o texto
 *   localizado oficial.
 */
export type ProvedorSocial = "apple" | "google";

export function provedoresSociais(flags: { google: boolean; apple: boolean }): ProvedorSocial[] {
  const lista: ProvedorSocial[] = [];
  if (flags.apple) lista.push("apple");
  if (flags.google) lista.push("google");
  return lista;
}

/** Texto do botão: o título localizado da Apple para pt-BR ("Continue with Apple"). */
export const ROTULO_APPLE = "Continuar com a Apple";
