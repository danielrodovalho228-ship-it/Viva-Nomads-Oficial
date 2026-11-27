"use server";

import { nomeCompletoDoAceite } from "@/lib/data/perfil-proprietario";

/**
 * E427: o nome COMPLETO do dono para quem já tem o aceite com ele (relação aceita ou visita confirmada) — a mesma função e o
 * mesmo critério de /proprietario/[id]. A página do anúncio é estática e indexável (revalidate 60 s): o nome completo
 * nunca entra no HTML dela; o cabeçalho e o "Sobre o proprietário" pedem aqui, depois de abrir, e quem não tem o aceite
 * recebe `nome: null`. FAIL-CLOSED: sem sessão, sem aceite ou qualquer erro → `nome: null` (a tela segue com o abreviado);
 * `falhou: true` marca o erro de leitura/sessão para a tela tentar de novo (antes, uma falha passageira deixava o nome
 * abreviado para sempre mesmo para quem tinha o aceite).
 */
export async function nomeDoDonoDepoisDoAceite(donoId: string): Promise<{ nome: string | null; falhou: boolean }> {
  try {
    return await nomeCompletoDoAceite(donoId);
  } catch {
    return { nome: null, falhou: true };
  }
}
