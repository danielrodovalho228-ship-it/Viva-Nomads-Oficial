/*
  E844 — o selo "Para trabalhar de casa" dos ANÚNCIOS DE EXEMPLO sai da mesma regra do anúncio real
  (qualification.tagHomeOffice: cômodo de trabalho, mesa, cadeira e internet que aguenta trabalho), lida do que o exemplo
  lista em "Estrutura de trabalho" (workFeatures) e da categoria de internet. Nunca um valor posto à mão. PURO.
*/
import type { InternetTier } from "../internet.ts";
import { tagHomeOffice } from "../qualification.ts";

interface CamposTrabalho {
  workFeatures?: readonly string[] | null;
  internetTier?: InternetTier | null;
}

export function estruturaDeTrabalhoDoExemplo(p: CamposTrabalho): { hasHomeOffice: boolean; hasDesk: boolean; hasChair: boolean } {
  const l = (p.workFeatures ?? []).map((s) => s.toLowerCase());
  return {
    hasHomeOffice: l.some((s) => /escrit[óo]rio|home office|c[ôo]modo de trabalho/.test(s)),
    hasDesk: l.some((s) => /\bmesa\b|bancada/.test(s)),
    hasChair: l.some((s) => /cadeira/.test(s)),
  };
}

export function tagHomeOfficeDoExemplo(p: CamposTrabalho): boolean {
  const e = estruturaDeTrabalhoDoExemplo(p);
  // Só os campos que a regra lê; o resto do QualityState não entra na etiqueta.
  return tagHomeOffice({ ...e, internetTier: (p.internetTier ?? "basica") as InternetTier } as Parameters<typeof tagHomeOffice>[0]);
}
