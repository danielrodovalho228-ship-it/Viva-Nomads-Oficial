/*
  E1064, perna 2 — o Resumo (passo 6) do Fechamento pelo estado REAL do contrato. Puro.
  O Resumo abria só com a marca local "contrato gerado nesta visita". A candidatura que já tem contrato (gerado e até
  assinado antes) nunca lá chegava sem gerar de novo. Agora abre também pelo contrato que existe — e, nesse caso, lê o
  que o contrato guarda. O que o contrato não guarda (serviços adicionais e seguro patrimonial escolhidos na visita)
  não aparece: a tela não inventa um valor para um contrato já assinado.
*/
import { GARANTIAS, type GarantiaContrato } from "./guarantees.ts";

/** O contrato que a candidatura já tem, como o servidor o lê (fonte única do estado do contrato). */
export interface ContratoDoFechamento {
  id: string;
  texto: string;
  criadoEm: string;
  /** A garantia gravada no contrato (contratos.garantia); null se a leitura não a trouxe. */
  garantia?: GarantiaContrato | null;
}

interface Entrada {
  geradoNestaVisita: boolean;
  contratoExistente: ContratoDoFechamento | null | undefined;
  demo: boolean;
}

/** De onde o Resumo lê: das escolhas desta visita (acabou de gerar) ou do contrato que já existe. null = não abre. */
export function fonteDoResumo(e: Entrada): "visita" | "contrato" | null {
  if (e.geradoNestaVisita) return "visita";
  return !e.demo && e.contratoExistente ? "contrato" : null;
}

/** O Resumo é acessível? (gerou agora, ou a candidatura já tem contrato) */
export function resumoAcessivel(e: Entrada): boolean {
  return fonteDoResumo(e) !== null;
}

/** O nome da garantia gravada no contrato, pelo catálogo; sem leitura, null (a linha não aparece). */
export function nomeDaGarantiaDoContrato(g: GarantiaContrato | null | undefined): string | null {
  if (g !== "caucao" && g !== "seguro_fianca") return null;
  const id = g === "seguro_fianca" ? "garantidor_digital" : "caucao";
  return GARANTIAS.find((x) => x.id === id)?.nome ?? null;
}
