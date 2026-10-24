/*
  RESUMOS DA PÁGINA DO IMÓVEL (Clareza UX2, ordem 0cc4b050) — regra pura.
  Tudo sai de dado real do anúncio; sem dado, a linha não existe.
*/
import type { Property } from "../types";
import { linhasPrivacidadePublica } from "./privacidade.ts";
import { proximidadesDoImovel, proximidadesVisiveis } from "./proximidades.ts";
import { linhasRegrasCasa, type ChaveRegraCasa } from "./regras-casa.ts";
import { linhasDetalhes } from "./detalhes-anuncio.ts";

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
  // PERTO-B: a mesma lista visível de "O que tem por perto" (o mais perto de cada categoria vem primeiro).
  const prox = proximidadesVisiveis(proximidadesDoImovel(p));
  const saude = prox.find((x) => x.categoria === "saude");
  const educ = prox.find((x) => x.categoria === "educacao");
  if (saude) d.push({ chave: "saude", titulo: `Perto de ${saude.nome}`, detalhe: saude.texto });
  if (educ) d.push({ chave: "educacao", titulo: `Perto de ${educ.nome}`, detalhe: educ.texto });
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
  /** Só em "regras": as mesmas linhas do detalhe, cada uma com a chave do seu ícone. */
  itens?: ItemRegraCasa[];
}

export type ChaveItemRegra = "pessoas" | "pets" | "entrada" | "saida" | ChaveRegraCasa;
export interface ItemRegraCasa {
  chave: ChaveItemRegra;
  texto: string;
}

/** Quantos fatos a linha-resumo de "Regras da casa" mostra (CAMPOS-1: continua curta). */
export const MAX_RESUMO_REGRAS = 2;

/*
  Textos fixos do "Bom saber" (prompt 4, 17/10). Só regras que a plataforma já aplica, sem regra
  jurídica nova; vocabulário público ("valor mensal", "Caução", "conferência de saída").
*/
export const CANCELAMENTO_DETALHE: readonly string[] = [
  "A estadia só é confirmada com o contrato assinado pelas duas partes.",
  "Antes da assinatura, nada é cobrado.",
  "A Caução fica registrada pela plataforma e é devolvida após a conferência de saída.",
  "As condições de saída antecipada estão no contrato, que o morador lê antes de assinar.",
  "O valor mensal vai direto para o proprietário — a Viva nunca retém o valor mensal.",
];

/** Proteções que valem para todo anúncio, declarado ou não. */
export const PROTECOES_VIVA: readonly string[] = [
  "Contato do proprietário e identidade do morador ficam protegidos até o aceite.",
  "A conversa acontece pelo chat da Viva e fica registrada.",
  "Aviso antigolpe: a Viva nunca pede PIX ou pagamento fora do contrato.",
  "Conferência de entrada com fotos, registrada na plataforma.",
];

export const SEGURANCA_SEM_DECLARACAO =
  "O anunciante ainda não declarou câmeras e acesso; pergunte pelo chat antes de fechar.";
export const RESUMO_SEGURANCA_SEM_DECLARACAO = "Proteções da Viva · câmeras e acesso a confirmar pelo chat";

const pessoas = (n: number) => `até ${n} ${n === 1 ? "pessoa" : "pessoas"}`;

const maiuscula = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);

/**
 * Itens da folha "Regras da casa": os fatos de sempre (pessoas, pets, entrada, saída) e depois as regras
 * estruturadas DEFINIDAS (CAMPOS-1: silêncio, fumo, festas, visitas). O que não foi definido não aparece.
 */
export function itensRegrasCasa(p: Property): ItemRegraCasa[] {
  const i: ItemRegraCasa[] = [];
  if (p.maxGuests != null) i.push({ chave: "pessoas", texto: maiuscula(pessoas(p.maxGuests)) });
  if (p.petsAllowed !== undefined) i.push({ chave: "pets", texto: p.petsAllowed ? "Aceita pets" : "Sem pets" });
  // CAMPOS-2: com a janela de entrada/saída ligada, ela substitui os horários antigos (uma linha só).
  const janela = linhasDetalhes(p.detalhesAnuncio).find((d) => d.chave === "janela");
  if (janela) i.push({ chave: "entrada", texto: janela.texto });
  else {
    if (p.checkinAfter) i.push({ chave: "entrada", texto: `Entrada a partir das ${p.checkinAfter}` });
    if (p.checkoutBefore) i.push({ chave: "saida", texto: `Saída até às ${p.checkoutBefore}` });
  }
  for (const r of linhasRegrasCasa(p.regrasCasa)) i.push(r);
  return i;
}

/** As 3 linhas do bloco "Bom saber". O detalhe completo continua em "Regras da estadia". */
export function linhasBomSaber(p: Property): LinhaBomSaber[] {
  const itens = itensRegrasCasa(p);
  const curtos = itens.slice(0, MAX_RESUMO_REGRAS).map((x, k) => (k === 0 ? x.texto : x.texto.charAt(0).toLowerCase() + x.texto.slice(1)));
  const regras = curtos.length > 0 ? curtos.join(" · ") : "Veja entrada, saída, pessoas e pets";

  const priv = linhasPrivacidadePublica(p.privacidade);
  const declarado = priv.filter((l) => /câmera|^Acesso:/i.test(l));
  const seguranca = declarado.length > 0 ? declarado.join(" · ") : RESUMO_SEGURANCA_SEM_DECLARACAO;

  return [
    {
      chave: "cancelamento",
      titulo: "Cancelamento",
      resumo: "Antes do contrato assinado, nada é cobrado",
      detalhe: [...CANCELAMENTO_DETALHE],
    },
    {
      chave: "regras",
      titulo: "Regras da casa",
      resumo: regras,
      detalhe: itens.length > 0 ? itens.map((x) => x.texto) : ["Sem regras informadas ainda."],
      itens,
    },
    {
      chave: "seguranca",
      titulo: "Segurança",
      resumo: seguranca,
      // Sempre as proteções da Viva; depois o que o anunciante declarou (ou o convite a perguntar).
      detalhe: [...PROTECOES_VIVA, ...(priv.length > 0 ? priv : [SEGURANCA_SEM_DECLARACAO])],
    },
  ];
}
