import { bairroAceitavel } from "../cep/bairro.ts";
/*
  Colunas do imóvel que o autosave do rascunho mantém em dia (PURO).

  A Visão geral e "Meus imóveis" calculam a prontidão pelas COLUNAS (não pelo draft_data).
  Se o autosave só gravasse título/cidade/preço, o checklist nunca marcaria "Endereço
  preenchido" nem "Detalhes básicos" antes de publicar (t8 T-RASC-6). Mesmo mapeamento
  da publicação: o campo `address` guarda o bairro.
*/

export interface InstantaneoRascunho {
  neighborhood?: string;
  bathrooms?: number;
  areaM2?: number;
  description?: string;
}

const inteiro = (n: unknown): number => {
  const v = Math.trunc(Number(n));
  return Number.isFinite(v) && v > 0 ? Math.min(v, 100_000) : 0;
};

export function camposDeConteudoDoRascunho(snap: InstantaneoRascunho): {
  address: string;
  bathrooms: number;
  area_m2: number;
  description: string;
} {
  return {
    // E147: bairro que é o estado/sigla nunca vai para a coluna (o rascunho guarda; a tela pede o bairro certo).
    address: bairroAceitavel(snap.neighborhood).slice(0, 200),
    bathrooms: Math.min(inteiro(snap.bathrooms), 50),
    area_m2: inteiro(snap.areaM2),
    description: (snap.description ?? "").trim().slice(0, 5000),
  };
}
