"use server";

import { nomeCompletoParaQuemTemAceite } from "@/lib/data/perfil-proprietario";

/**
 * E427: o nome COMPLETO do dono para quem já tem o aceite com ele (relação aceita ou visita confirmada) — a mesma função e o
 * mesmo critério de /proprietario/[id]. A página do anúncio é estática e indexável (revalidate 60 s): o nome completo
 * nunca entra no HTML dela; o "Sobre o proprietário" pede aqui, depois de abrir, e quem não tem o aceite recebe null.
 * FAIL-CLOSED: sem sessão, sem aceite ou qualquer erro → null (a tela segue com o nome abreviado).
 */
export async function nomeDoDonoDepoisDoAceite(donoId: string): Promise<string | null> {
  try {
    return await nomeCompletoParaQuemTemAceite(donoId);
  } catch {
    return null;
  }
}
