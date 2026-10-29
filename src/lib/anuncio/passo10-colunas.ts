/*
  E251 — PASSO 10 (REVISÃO) EM DUAS COLUNAS (PURO; desenho aprovado pelo coordenador em 29/10).
   • À esquerda, "Antes de publicar": a lista de prontidão e as seções legais (quem opera, identidade, documento,
     declarações), cada uma um item com estado que abre no lugar (acordeão).
   • À direita, fixa: a prévia com os três preços (Mensal · Total por mês (com contas) · Estadia mínima (N meses)) e
     UM "Publicar anúncio", travado com o motivo em UMA linha enquanto faltar algo.
  As regras de publicar não mudam: os 12 itens do essencial (prontidão) + isEligible (convenção "Não sei" publica com
  pendência; "Não" bloqueia) + o aceite do termo da IA. Aqui só se decide o que a tela diz.
*/
import type { ItemProntidao } from "./prontidao.ts";
import type { DeclaracoesPasso10 } from "./requisitos-passo10.ts";
import { TEXTO_HABITAVEL, TEXTO_IPTU } from "./requisitos-passo10.ts";
import { ROTULO_MENSAL, ROTULO_TOTAL_MES, precoDoImovel, rotuloEstadiaMinima } from "../precos.ts";
import { mesesDoCartao } from "../cartao-preco.ts";
import type { Property } from "../types.ts";

export type SecaoAntesDePublicar = "operacao" | "identidade" | "documento" | "declaracoes";
/** "ok" = ✓; "falta" = segura a publicação; "aviso" = em andamento ou opcional (não segura a publicação). */
export type EstadoSecao = "ok" | "falta" | "aviso";

export interface ItemSecao {
  id: SecaoAntesDePublicar;
  titulo: string;
  estado: EstadoSecao;
  /** Uma linha: o que já está feito ou o que falta. */
  resumo: string;
}

export const TITULO_SECAO: Record<SecaoAntesDePublicar, string> = {
  operacao: "Quem opera o imóvel",
  identidade: "Sua identidade",
  documento: "Documento do imóvel",
  declaracoes: "Declarações do imóvel",
};

export type EstadoDocumento = "nenhum" | "revisao" | "aprovado" | "corrija";
export type EstadoIdentidade = "ok" | "em_breve" | "pendente" | "sem_cpf" | "carregando";

export interface EntradaSecoes {
  /** O que ainda falta na operação (declaração, tipo do documento ou anexo); "" = nada. */
  faltaOperacao: string;
  /** Rótulo da operação escolhida ("Sou o proprietário"…). */
  rotuloOperacao: string;
  identidade: EstadoIdentidade;
  documento: EstadoDocumento;
  /** E149-A: "Documento enviado no início · em análise/aprovado", quando veio pela matrícula. */
  linhaDocumentoInicio?: string | null;
  declaracoes: DeclaracoesPasso10;
  emCondominio: boolean;
}

/** As quatro seções legais, na ordem do cartão, com o estado e a linha de resumo. */
export function secoesAntesDePublicar(e: EntradaSecoes): ItemSecao[] {
  const operacao: ItemSecao = e.faltaOperacao
    ? { id: "operacao", titulo: TITULO_SECAO.operacao, estado: "falta", resumo: e.faltaOperacao }
    : { id: "operacao", titulo: TITULO_SECAO.operacao, estado: "ok", resumo: e.rotuloOperacao };

  // A identidade ajuda a conferir a matrícula, mas não segura a publicação (a equipe confere o documento).
  const identidade: ItemSecao = {
    id: "identidade",
    titulo: TITULO_SECAO.identidade,
    estado: e.identidade === "ok" ? "ok" : "aviso",
    resumo:
      e.identidade === "ok"
        ? "Confirmada"
        : e.identidade === "em_breve"
          ? "Confirmação ainda não disponível"
          : e.identidade === "carregando"
            ? "Conferindo…"
            : "Opcional: a equipe confere o documento",
  };

  const docInicio = e.linhaDocumentoInicio?.trim() || null;
  const documento: ItemSecao =
    e.documento === "aprovado"
      ? { id: "documento", titulo: TITULO_SECAO.documento, estado: "ok", resumo: docInicio ?? "Conferido" }
      : e.documento === "revisao"
        ? { id: "documento", titulo: TITULO_SECAO.documento, estado: "falta", resumo: docInicio ?? "Em análise: a equipe confere em até 48 horas" }
        : e.documento === "corrija"
          ? { id: "documento", titulo: TITULO_SECAO.documento, estado: "falta", resumo: "Corrija o documento" }
          : { id: "documento", titulo: TITULO_SECAO.documento, estado: "falta", resumo: "Ainda não enviado" };

  const d = e.declaracoes;
  const faltam = [!d.iptuOk && TEXTO_IPTU, !d.habitavel && TEXTO_HABITAVEL, e.emCondominio && d.convencao === "" && "convenção do condomínio"].filter(Boolean) as string[];
  const declaracoes: ItemSecao =
    e.emCondominio && d.convencao === "no"
      ? { id: "declaracoes", titulo: TITULO_SECAO.declaracoes, estado: "falta", resumo: "A convenção não permite: o anúncio não publica" }
      : faltam.length > 0
        ? { id: "declaracoes", titulo: TITULO_SECAO.declaracoes, estado: "falta", resumo: `Falta: ${faltam.join(", ")}` }
        : e.emCondominio && d.convencao === "unknown"
          ? { id: "declaracoes", titulo: TITULO_SECAO.declaracoes, estado: "ok", resumo: "Convenção: não sei (publica com pendência)" }
          : { id: "declaracoes", titulo: TITULO_SECAO.declaracoes, estado: "ok", resumo: "Feitas" };

  return [operacao, identidade, documento, declaracoes];
}

/** Nome curto de cada item da prontidão na linha do motivo ("Falta: documento do imóvel"). */
const NOME_CURTO: Record<string, string> = {
  endereco: "endereço",
  detalhes: "detalhes do imóvel",
  periodo: "período de estadia",
  fotos: "fotos",
  titulo: "título",
  descricao: "descrição",
  preco: "valor mensal",
  garantia: "garantia",
  documento: "documento do imóvel",
  qualificacao: "declarações do imóvel",
  tipo_entrada: "tipo de entrada",
  internet: "velocidade da internet",
  sem_internet: "internet no imóvel",
  chacara: "dados da chácara",
  sublocacao: "autorização de quem opera",
  privacidade: "declaração de câmeras",
  conforto: "padrão mínimo de conforto",
};

const minuscula = (s: string) => (s ? s[0].toLowerCase() + s.slice(1) : s);

/** O que segura o "Publicar anúncio", na ordem da lista (sem repetir). */
export function oQueFaltaParaPublicar(p: { completude: ItemProntidao[]; declaracoesOk: boolean; aceitouIa: boolean }): string[] {
  const nomes = p.completude.filter((i) => !i.ok).map((i) => NOME_CURTO[i.key] ?? minuscula(i.label));
  if (!p.declaracoesOk) nomes.push(NOME_CURTO.qualificacao);
  if (!p.aceitouIa) nomes.push("aceite do termo da IA");
  return [...new Set(nomes)];
}

/** O motivo em UMA linha ("Falta: documento do imóvel" ou "… e mais 2"); null quando nada falta. */
export function motivoPublicarTravado(faltam: string[]): string | null {
  if (faltam.length === 0) return null;
  return faltam.length === 1 ? `Falta: ${faltam[0]}` : `Falta: ${faltam[0]} e mais ${faltam.length - 1}`;
}

export interface LinhaPrecoPrevia {
  rotulo: string;
  valor: number | null;
  /** Só na estadia mínima: a conta aberta ("2 × R$ 3.400 = R$ 6.800"). */
  conta?: string | null;
}

/**
  Os três preços da prévia: Mensal · Total por mês (com contas) · Estadia mínima (N meses). O anúncio ainda não tem
  contrato (E251 d): o total do período é o da estadia mínima, com a mesma conta do "Total do contrato" (PROP-2).
*/
export function precosDaPrevia(property: Property): LinhaPrecoPrevia[] {
  const meses = mesesDoCartao(undefined, property.minPeriodDays);
  const p = precoDoImovel(property, meses);
  return [
    { rotulo: ROTULO_MENSAL, valor: p.mensal },
    { rotulo: ROTULO_TOTAL_MES, valor: p.totalPorMes },
    { rotulo: rotuloEstadiaMinima(meses), valor: p.totalContrato, conta: p.conta },
  ];
}

/** Evento da página que abre uma seção do "Antes de publicar" (o "Resolver" da lista e o motivo do botão travado). */
export const EVENTO_ABRIR_SECAO = "vn:passo10-abrir-secao";

/** A seção do "Antes de publicar" que resolve um item da prontidão (null = o item mora noutro passo). */
export function secaoDoItem(chave: string): SecaoAntesDePublicar | null {
  if (chave === "documento") return "documento";
  if (chave === "sublocacao") return "operacao";
  if (chave === "qualificacao") return "declaracoes";
  return null;
}
