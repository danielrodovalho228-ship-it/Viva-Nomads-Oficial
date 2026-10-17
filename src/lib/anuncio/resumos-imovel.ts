/*
  RESUMOS DA PÁGINA DO IMÓVEL (Clareza UX2, ordem 0cc4b050) — regra pura.
  Tudo sai de dado real do anúncio; sem dado, a linha não existe.
*/
import type { Property } from "../types";
import { linhasPrivacidadePublica } from "./privacidade.ts";
import { distanciaAprox, proximidadesDoImovel } from "./proximidades.ts";

export type ChaveDestaque = "saude" | "educacao" | "pronto" | "trabalho" | "vaga";
export interface Destaque {
  chave: ChaveDestaque;
  titulo: string;
  detalhe?: string;
}

export const MAX_DESTAQUES = 3;
/** Acima disto a descrição ganha "Mostrar mais" (≈ 5 linhas no celular). */
export const LIMITE_DESCRICAO_CURTA = 280;

/** Até 3 destaques, em ordem de relevância; só com dado cadastrado. */
export function destaquesDoImovel(p: Property): Destaque[] {
  const d: Destaque[] = [];
  const prox = proximidadesDoImovel(p);
  const saude = prox.find((x) => x.category === "saude" && x.name.trim());
  const educ = prox.find((x) => x.category === "educacao" && x.name.trim());
  if (saude) d.push({ chave: "saude", titulo: `Perto de ${saude.name.trim()}`, detalhe: distanciaAprox(saude.note) });
  if (educ) d.push({ chave: "educacao", titulo: `Perto de ${educ.name.trim()}`, detalhe: distanciaAprox(educ.note) });
  if (p.readyToLiveBadge) d.push({ chave: "pronto", titulo: "Pronto para morar", detalhe: "Imóvel mobiliado e equipado" });
  if (p.tagHomeOffice || (p.workFeatures ?? []).length > 0)
    d.push({ chave: "trabalho", titulo: "Espaço para trabalhar", detalhe: p.workFeatures?.[0] });
  const vagas = p.parkingSpots ?? 0;
  if (vagas > 0) d.push({ chave: "vaga", titulo: `${vagas} ${vagas === 1 ? "vaga" : "vagas"} de garagem` });
  return d.slice(0, MAX_DESTAQUES);
}

export function descricaoPrecisaMostrarMais(descricao: string | null | undefined): boolean {
  return (descricao ?? "").trim().length > LIMITE_DESCRICAO_CURTA;
}

export type ChaveBomSaber = "cancelamento" | "regras" | "seguranca";
export interface LinhaBomSaber {
  chave: ChaveBomSaber;
  titulo: string;
  resumo: string;
  detalhe: string[];
}

const pessoas = (n: number) => `até ${n} ${n === 1 ? "pessoa" : "pessoas"}`;

/** As 3 linhas do bloco "Bom saber". O detalhe completo continua em "Regras da estadia". */
export function linhasBomSaber(p: Property): LinhaBomSaber[] {
  const partes: string[] = [];
  if (p.checkinAfter) partes.push(`entrada a partir das ${p.checkinAfter}`);
  if (p.checkoutBefore) partes.push(`saída até às ${p.checkoutBefore}`);
  if (p.maxGuests != null) partes.push(pessoas(p.maxGuests));
  if (p.petsAllowed !== undefined) partes.push(p.petsAllowed ? "aceita pets" : "sem pets");
  const regras = partes.length > 0 ? partes.join(" · ") : "Veja entrada, saída, pessoas e pets";

  const priv = linhasPrivacidadePublica(p.privacidade);
  const seguranca =
    priv.length > 0 ? priv.filter((l) => /câmera/i.test(l)).join(" · ") || priv[0] : "Não informado pelo anunciante";

  return [
    {
      chave: "cancelamento",
      titulo: "Cancelamento",
      resumo: "Segue as condições do contrato da estadia",
      detalhe: [
        "As condições de cancelamento ficam no contrato da estadia, que as duas partes leem e assinam antes da entrada.",
        "A Caução fica registrada e documentada pela plataforma. A Viva nunca retém o aluguel.",
      ],
    },
    {
      chave: "regras",
      titulo: "Regras da casa",
      resumo: regras,
      detalhe: partes.length > 0 ? partes.map((x) => x.charAt(0).toUpperCase() + x.slice(1)) : ["Sem regras informadas ainda."],
    },
    {
      chave: "seguranca",
      titulo: "Segurança",
      resumo: seguranca,
      detalhe: priv.length > 0 ? priv : ["O anunciante ainda não declarou câmeras nem tipo de acesso."],
    },
  ];
}
