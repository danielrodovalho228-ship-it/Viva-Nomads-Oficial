/*
  E1079/E1080 (ORDEM-DUET-385/386) — a BASE de dados das superfícies do avaliador, sem tela: a listagem pública por
  cidade, o perfil público e o cartão de escolha do dono usam os mesmos cartões. PURO (node --test).
  As telas esperam os 12 mockups aprovados (a QA é print × mockup); até lá nada aqui aparece ao público.
  Condições do coordenador (DUET-1455): a listagem por cidade nasce DESLIGADA ("só piloto"); nenhuma foto de pessoa
  real em perfil público sem o Daniel — por agora só a conta de teste mostra a foto; as outras, as iniciais.
  ORDEM-386: a foto é a de perfil da conta (fonte única: o envio de foto de perfil); nunca obrigatória; sem foto,
  as iniciais no círculo — nunca ícone sozinho nem espaço vazio. Nada diz "credenciado com o CNPJ da Viva".
*/
import { iniciais } from "../avatar.ts";
import { atendeCidade } from "./regras.ts";

/** A listagem pública por cidade: desligada até o Daniel a abrir (condição 2 do coordenador). */
export const VITRINE_AVALIADORES_ABERTA = false;

/** Por agora, só a foto da conta de teste aparece em superfície pública (condição 3 do coordenador). */
export function fotoPublicaPermitida(contaTeste: boolean): boolean {
  return contaTeste === true;
}

export type Rosto = { tipo: "foto"; url: string } | { tipo: "iniciais"; texto: string };

/** A foto quando há e pode aparecer; senão as iniciais — nunca vazio nem "?". */
export function rostoDoAvaliador(nome: string, fotoUrl: string | null | undefined, contaTeste: boolean): Rosto {
  if (fotoUrl && fotoPublicaPermitida(contaTeste)) return { tipo: "foto", url: fotoUrl };
  const t = iniciais(nome);
  return { tipo: "iniciais", texto: t === "?" ? "AV" : t };
}

export interface FonteAvaliador {
  numero: string;
  nome: string;
  cidade: string;
  selo: string | null;
  avaliacoesFeitas: number;
  notaConduta: number | null;
  contaTeste: boolean;
  fotoUrl: string | null;
}

export interface CartaoAvaliador {
  numero: string;
  nome: string;
  cidade: string;
  selo: string | null;
  avaliacoesFeitas: number;
  notaConduta: number | null;
  rosto: Rosto;
  href: string;
}

export function cartaoDoAvaliador(a: FonteAvaliador): CartaoAvaliador {
  return {
    numero: a.numero,
    nome: a.nome.trim(),
    cidade: a.cidade,
    selo: a.selo,
    avaliacoesFeitas: Math.max(0, Math.floor(Number(a.avaliacoesFeitas) || 0)),
    notaConduta: a.notaConduta == null || !Number.isFinite(Number(a.notaConduta)) ? null : Number(a.notaConduta),
    rosto: rostoDoAvaliador(a.nome, a.fotoUrl, a.contaTeste),
    href: `/avaliadores/${encodeURIComponent(a.numero)}`,
  };
}

/**
 * Os cartões de uma cidade: quem atende a cidade (várias cidades contam, E1077-b2), sem número repetido (o
 * credenciado vence o perfil mínimo do mesmo número), mais avaliações feitas primeiro, depois o nome.
 */
export function cartoesDaCidade(fontes: readonly FonteAvaliador[], cidade: string): CartaoAvaliador[] {
  const porNumero = new Map<string, FonteAvaliador>();
  for (const f of fontes) if (atendeCidade(f.cidade, cidade) && !porNumero.has(f.numero)) porNumero.set(f.numero, f);
  return [...porNumero.values()].map(cartaoDoAvaliador).sort((a, b) => b.avaliacoesFeitas - a.avaliacoesFeitas || a.nome.localeCompare(b.nome, "pt-BR"));
}
