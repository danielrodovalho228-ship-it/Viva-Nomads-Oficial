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
import { atendeCidade, ROTULO_AVALIADOR_CREDENCIADO, ROTULO_AVALIADOR_EM_TESTE, ROTULO_PORTE, PORTES, precoVigente, type LinhaPreco, type Porte } from "./regras.ts";
import { chaveCidade } from "../cidades.ts";

/** A listagem pública por cidade: desligada até o Daniel a abrir (condição 2 do coordenador). */
export const VITRINE_AVALIADORES_ABERTA = false;

/** Por agora, só a foto da conta de teste aparece em superfície pública (condição 3 do coordenador). */
export function fotoPublicaPermitida(contaTeste: boolean): boolean {
  return contaTeste === true;
}

/**
 * E1097 (ORDEM-DUET-454/455): o selo público do credenciado — "Avaliador credenciado" para todos; a conta de teste,
 * "Avaliador em teste" (E717). "Avaliador sócio da Viva" é só do Rogério: chega aqui apenas pela linha dele em
 * avaliadores_perfil_publico ligada ao credenciamento (`seloLigado`), nunca por regra geral.
 */
export function seloDoCredenciado(teste: boolean, seloLigado: string | null): string {
  if (teste) return ROTULO_AVALIADOR_EM_TESTE;
  return seloLigado?.trim() ? seloLigado.trim() : ROTULO_AVALIADOR_CREDENCIADO;
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
  /** E1099 parte 3: a identidade da conta CONFIRMADA (estadoIdentidade). Sem o fato (piloto, sem leitura): ausente/false. */
  identidadeVerificada?: boolean;
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
  identidadeVerificada: boolean;
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
    identidadeVerificada: a.identidadeVerificada === true,
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
/** E1099 (ORDEM-DUET-458 §2): o "Sobre" do perfil — texto do próprio avaliador, opcional (0355: até 600 caracteres). */
export const TITULO_SOBRE = "Sobre";
export const SOBRE_MAX = 600;
/** ORDEM-DUET-462 §1: uma frase curta, simples, que diz onde o texto aparece. */
export const EXPLICACAO_SOBRE = "Opcional: este texto aparece no seu perfil público.";
/** O texto do "Sobre": aparado; vazio = nada (a secção some); acima do limite, recusado com o motivo. */
export function normalizarSobre(texto: string): { ok: true; valor: string | null } | { ok: false; erro: string } {
  const t = String(texto ?? "").trim();
  if (!t) return { ok: true, valor: null };
  if (t.length > SOBRE_MAX) return { ok: false, erro: `O texto "Sobre" tem até ${SOBRE_MAX} caracteres.` };
  return { ok: true, valor: t };
}

// ── E1080 (ORDEM-DUET-385): a listagem pública por cidade (/avaliadores/<cidade>) ───────────────────────────────
/** Número de avaliador ("UDI-003") — o resto do caminho /avaliadores/<…> é o nome da cidade. */
export function ehNumeroDeAvaliador(s: string): boolean {
  return /^[A-Z]{3}-\d{3,}$/.test(String(s ?? "").toUpperCase());
}

/** A cidade do caminho ("uberlandia" → Uberlândia/MG) pela lista do IBGE; só quando é uma cidade só. */
export function cidadeDoSlug(municipios: Readonly<Record<string, readonly string[]>>, slug: string): { cidade: string; uf: string } | null {
  const k = chaveCidade(decodeURIComponent(String(slug ?? "")).replace(/-/g, " "));
  if (!k) return null;
  const achadas = Object.entries(municipios).flatMap(([uf, lista]) => lista.filter((c) => chaveCidade(c) === k).map((cidade) => ({ cidade, uf })));
  return achadas.length === 1 ? achadas[0] : null;
}

/** "uberlandia" a partir de "Uberlândia". */
export function slugDaCidade(cidade: string): string {
  return chaveCidade(cidade).replace(/\s+/g, "-");
}

/** Desligada para o público até o Daniel abrir (só piloto); no laboratório abre para construir e testar. */
export function vitrineAberta(laboratorio: boolean): boolean {
  return VITRINE_AVALIADORES_ABERTA || laboratorio;
}

export const TITULO_VITRINE = (cidade: string) => `Avaliadores em ${cidade}`;
export const PLACEHOLDER_BUSCA_CIDADE = "Buscar por cidade";
export const ROTULO_VER_PERFIL = "Ver perfil";
export const textoAvaliacoes = (n: number) => (n === 1 ? "1 avaliação" : `${n} avaliações`);
