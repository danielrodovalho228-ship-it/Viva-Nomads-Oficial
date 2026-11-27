/*
  E625 — a massa de QA que leva dois anúncios de teste a Conforto e a Premium PELO MOTOR (nivelDoImovel). PURO.
  A migração 0304 grava exatamente estas entradas (itens por foto, medições do 57, ruído); o teste confere que o motor
  devolve o nível e as áreas escritos na migração. Nenhum nível é escrito à mão sem o motor concordar.
*/
import { AREAS, MATRIZ, itemNivel, type Area, type ChaveNivel, type Nivel } from "../../config/niveis.ts";
import { VERSAO_CONFORTO, CHAVES_CONFORTO } from "../../config/conforto-minimo.ts";
import { nivelDoImovel, type EntradaNivel, type ItemDeclarado, type MedidaPonto, type ResultadoNivel } from "./regras.ts";

/** Os itens de nível provados por FOTO que cada alvo declara (os de medida e ruído têm entrada própria). */
export function itensFotoDoAlvo(alvo: "conforto" | "premium"): ChaveNivel[] {
  const s = new Set<ChaveNivel>();
  for (const a of AREAS as readonly Area[]) {
    for (const k of MATRIZ[a].conforto) s.add(k);
    if (alvo === "premium") for (const k of MATRIZ[a].premium) s.add(k);
  }
  return [...s].filter((k) => itemNivel(k).prova === "foto");
}

/** Medições do dono por ponto: o quarto principal e o ponto de trabalho (passa a regra de videochamada). */
export const MEDICOES_SEMENTE = [
  { ponto: "quarto_principal", downloadMbps: 120, uploadMbps: 60, latenciaMs: 18 },
  { ponto: "trabalho", downloadMbps: 110, uploadMbps: 55, latenciaMs: 20 },
] as const;

export function graduarSemente(alvo: "conforto" | "premium", agora: Date): ResultadoNivel {
  const entrada: EntradaNivel = {
    declaracoesConforto: CHAVES_CONFORTO.map((chave) => ({ chave, confirmado: true, versao_lista: VERSAO_CONFORTO })),
    itens: itensFotoDoAlvo(alvo).map((chave): ItemDeclarado => ({ chave, declarado: true, fotoPath: "x/y.webp", fotoStatus: "aceita", fotoOrigem: "camera", refazerAte: null })),
    medidas: MEDICOES_SEMENTE.map((m): MedidaPonto => ({
      ponto: m.ponto, downloadMbps: m.downloadMbps, uploadMbps: m.uploadMbps, latenciaMs: m.latenciaMs, validada: true,
      medidoEm: agora.toISOString(), validoAte: new Date(agora.getTime() + 150 * 86_400_000).toISOString(),
    } as MedidaPonto)),
    ruido: { via_intensa: false, noturno_obra_100m: false, aviao_ferrovia: false, isolamento_acustico: false },
    bloqueadas: [],
    agora,
  };
  return nivelDoImovel(entrada);
}
export type { Nivel };
