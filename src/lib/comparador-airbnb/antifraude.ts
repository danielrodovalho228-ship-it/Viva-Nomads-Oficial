/*
  E399-C, pacote 1 — trava antifraude do link do Airbnb: o anúncio colado tem que ser o MESMO imóvel. Confere a cidade
  (sem acento e sem caixa) e o número de quartos do anúncio no Airbnb com o imóvel da Viva. Divergência bloqueia o selo
  "Preço justo" e entra na Central de Pendências do admin. Sem dado do anúncio, não confere. PURO.
  Roda: node --test src/lib/comparador-airbnb/pacote1.test.ts
*/
import { chaveCidade } from "../cidades.ts";

export type Divergencia = "cidade" | "quartos";
export type Conferencia = "pendente" | "confere" | "diverge";

export interface DadosDoImovel {
  cidade: string | null | undefined;
  quartos: number | null | undefined;
}

export const TEXTO_DIVERGENCIA: Record<Divergencia, string> = {
  cidade: "A cidade do anúncio no Airbnb não é a deste imóvel.",
  quartos: "O número de quartos do anúncio no Airbnb não é o deste imóvel.",
};

export function conferirAnuncio(viva: DadosDoImovel, airbnb: DadosDoImovel): { confere: boolean; divergencias: Divergencia[] } {
  const divergencias: Divergencia[] = [];
  const cv = chaveCidade(viva.cidade);
  const ca = chaveCidade(airbnb.cidade);
  if (!cv || !ca || cv !== ca) divergencias.push("cidade");
  const qv = Number(viva.quartos);
  const qa = Number(airbnb.quartos);
  if (airbnb.quartos == null || viva.quartos == null || !Number.isFinite(qv) || !Number.isFinite(qa) || qv !== qa) divergencias.push("quartos");
  return { confere: divergencias.length === 0, divergencias };
}

/** Sem link, não há selo. Com link, só o anúncio que confere segue para a comparação de preço (pacote 2). */
export function situacaoDoLink(link: { conferencia: Conferencia } | null): { podeTerSelo: boolean; motivo: "sem_link" | "conferindo" | "diverge" | null } {
  if (!link) return { podeTerSelo: false, motivo: "sem_link" };
  if (link.conferencia === "diverge") return { podeTerSelo: false, motivo: "diverge" };
  if (link.conferencia !== "confere") return { podeTerSelo: false, motivo: "conferindo" };
  return { podeTerSelo: true, motivo: null };
}
