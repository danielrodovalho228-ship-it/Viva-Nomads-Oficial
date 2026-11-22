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
import { atendeCidade, ROTULO_PORTE, PORTES, precoVigente, type LinhaPreco, type Porte } from "./regras.ts";
import { chaveCidade } from "../cidades.ts";

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

// ── E1079 (ORDEM-DUET-397): o perfil público no desenho do mockup aprovado ─────────────────────────────────────

/** Rótulos curtos do quadro "Preço da avaliação" (os do mockup aprovado); a ordem é a dos portes. */
export const ROTULO_PORTE_QUADRO: Record<Porte, string> = { estudio: "Estúdio", q1_2: "1–2 quartos", q3_mais: "3+ quartos" };

export interface LinhaQuadroPreco {
  porte: Porte;
  rotulo: string;
  valor: number;
}

/**
 * O preço é o da TABELA DA CIDADE (ORDEM-DUET-397, ponto 3), por porte — nunca um preço por avaliador. Só os portes com
 * valor vigente entram; sem nenhum, o quadro não aparece.
 */
export function quadroDePreco(tabela: readonly LinhaPreco[], cidade: string, agora: Date): LinhaQuadroPreco[] {
  return PORTES.flatMap((porte) => {
    const p = precoVigente([...tabela], cidade, porte, agora);
    return p ? [{ porte, rotulo: ROTULO_PORTE_QUADRO[porte] ?? ROTULO_PORTE[porte], valor: Number(p.valor) }] : [];
  });
}

/** "R$ 150" (inteiro) ou "R$ 150,50" — o formato do quadro. */
export function reaisCurtos(v: number): string {
  const inteiro = Math.round(v * 100) % 100 === 0;
  return `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: inteiro ? 0 : 2, maximumFractionDigits: 2 })}`;
}

/** A UF da cidade pela lista do IBGE, só quando o nome é de uma cidade só (sem ambiguidade); senão null. */
export function ufDaCidade(municipios: Readonly<Record<string, readonly string[]>>, cidade: string): string | null {
  const k = chaveCidade(cidade);
  if (!k) return null;
  const ufs = Object.entries(municipios).filter(([, lista]) => lista.some((c) => chaveCidade(c) === k)).map(([uf]) => uf);
  return ufs.length === 1 ? ufs[0] : null;
}

/** "Uberlândia · MG" (ou só a cidade, quando a UF não é única). */
export function linhaDaCidade(cidade: string, uf: string | null): string {
  return uf ? `${cidade} • ${uf}` : cidade;
}

/** Sem avaliações feitas nem nota de conduta: o estado "Novo na Viva" do mockup. */
export function novoNaViva(avaliacoesFeitas: number, notaConduta: number | null): boolean {
  return !(Number(avaliacoesFeitas) > 0) && notaConduta == null;
}

export const TITULO_PERFIL = "Perfil do Avaliador";
export const TITULO_NOVO_NA_VIVA = "Novo na Viva";
export const TEXTO_NOVO_NA_VIVA = "Este avaliador ainda não tem avaliações — seja o primeiro a contratar.";
export const TITULO_QUADRO_PRECO = "Preço da avaliação";
export const TEXTO_IDENTIDADE_VERIFICADA = "Identidade verificada pela Viva";
