/*
  Prompt 59, Parte A — padrão mínimo de conforto (PURO, relógio injetável). Uma regra só para o bloqueio de publicação
  (servidor), o aviso no painel do dono, o cron (lembretes e pausa), a conferência de entrada, as pendências, o selo e a
  exibição (59-A).

  - Publicar exige TODOS os itens da lista atual confirmados pelo dono.
  - Anúncio já publicado quando a regra entrou (D4): prazo de 30 dias; vencido sem confirmar, sai da busca (pausado por
    conforto) e volta ao confirmar. Contas de teste seguem a mesma regra.
  - "Não confere" na entrada vira pendência do dono: prazo de correção = o de solução da prioridade MÉDIA (72 h); o morador
    confirma em 48 h ou reabre; sem resposta, conta como corrigida. Contestação: decide o atendimento da Viva (admin).
  - 2 pendências PROCEDENTES em 12 meses móveis tiram o selo "Proprietário verificado" e a nota cai; aviso na 1ª.
  - Nada financeiro (D7).
*/
import { ITENS_CONFORTO, LEMBRETES_ADEQUACAO_DIAS, PRAZO_ADEQUACAO_DIAS, VERSAO_CONFORTO, ehChaveConforto, type ChaveConforto } from "../../config/conforto-minimo.ts";
import { PRAZO_SOLUCAO_H } from "../../config/atendimento.ts";

const HORA_MS = 3_600_000;
const DIA_MS = 86_400_000;

// ── Declarações do dono ──────────────────────────────────────────────────────────────────────────────────────────
export interface DeclaracaoConforto {
  chave: string;
  confirmado: boolean;
  versao_lista?: number | null;
}

/** Itens da lista ATUAL que o dono ainda não confirmou (itens novos de outra versão entram aqui; os antigos valem). */
export function itensFaltantes(declaracoes: readonly DeclaracaoConforto[]): ChaveConforto[] {
  // Confirmação de versão anterior à do critério atual do item não vale (item novo ou critério mudado: reconfirma).
  const versao = new Map(declaracoes.filter((d) => d.confirmado && ehChaveConforto(d.chave)).map((d) => [d.chave, d.versao_lista ?? 1]));
  return ITENS_CONFORTO.filter((i) => (versao.get(i.chave) ?? 0) < i.desdeVersao).map((i) => i.chave);
}

/** Bloqueio de publicação: só com todos confirmados. A mensagem lista o que falta. */
export function podePublicarConforto(declaracoes: readonly DeclaracaoConforto[]): { ok: true } | { ok: false; faltantes: ChaveConforto[]; erro: string } {
  const faltantes = itensFaltantes(declaracoes);
  if (faltantes.length === 0) return { ok: true };
  const nomes = faltantes.map((k) => ITENS_CONFORTO.find((i) => i.chave === k)!.rotulo);
  return { ok: false, faltantes, erro: `Para publicar, confirme o padrão mínimo de conforto: ${nomes.join(", ")}.` };
}

/** Linhas a gravar quando o dono confirma (só chaves conhecidas, na versão atual da lista). */
export function linhasConfirmacao(propertyId: string, chaves: readonly unknown[], donoId: string, agora: Date) {
  const unicas = [...new Set(chaves.filter(ehChaveConforto))];
  return unicas.map((chave) => ({
    property_id: propertyId,
    chave,
    confirmado: true,
    confirmado_por: donoId,
    confirmado_em: agora.toISOString(),
    versao_lista: VERSAO_CONFORTO,
  }));
}

// ── Prazo de adequação (anúncios já publicados) ──────────────────────────────────────────────────────────────────
export function prazoAdequacao(diaDaRegra: Date): Date {
  return new Date(diaDaRegra.getTime() + PRAZO_ADEQUACAO_DIAS * DIA_MS);
}

/** Dias inteiros que faltam até o fim do prazo (0 no último dia; negativo depois). */
export function diasParaPrazo(prazoAte: string | Date, agora: Date): number {
  return Math.ceil((new Date(prazoAte).getTime() - agora.getTime()) / DIA_MS);
}

/** Lembrete de hoje (15 ou 3 dias antes), se houver. */
export function lembreteAdequacao(prazoAte: string | null, completo: boolean, agora: Date): (typeof LEMBRETES_ADEQUACAO_DIAS)[number] | null {
  if (!prazoAte || completo) return null;
  const d = diasParaPrazo(prazoAte, agora);
  return (LEMBRETES_ADEQUACAO_DIAS as readonly number[]).includes(d) ? (d as (typeof LEMBRETES_ADEQUACAO_DIAS)[number]) : null;
}

/** Vencido sem confirmar: o anúncio sai da busca (pausado por conforto). */
export const deveSairDaBusca = (prazoAte: string | null, completo: boolean, agora: Date) =>
  !completo && !!prazoAte && new Date(prazoAte).getTime() <= agora.getTime();

export type SituacaoConforto = "completo" | "em_adequacao" | "vencido" | "incompleto";

export interface EstadoConforto {
  itens: { chave: ChaveConforto; rotulo: string; criterio: string; confirmado: boolean }[];
  faltantes: ChaveConforto[];
  completo: boolean;
  prazoAte: string | null;
  situacao: SituacaoConforto;
  /** "Confirme o padrão mínimo até 21/11/2026" (painel do dono), ou null. */
  aviso: string | null;
}

const dataBR = (d: Date) => d.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });

/** estadoConfortoMinimo(property) — para o painel do dono e a exibição (59-A). */
export function estadoConfortoMinimo(declaracoes: readonly DeclaracaoConforto[], prazoAte: string | null, agora: Date): EstadoConforto {
  const faltantes = itensFaltantes(declaracoes);
  const falta = new Set<string>(faltantes);
  const completo = faltantes.length === 0;
  const situacao: SituacaoConforto = completo ? "completo" : !prazoAte ? "incompleto" : deveSairDaBusca(prazoAte, false, agora) ? "vencido" : "em_adequacao";
  const aviso =
    situacao === "em_adequacao"
      ? `Confirme o padrão mínimo até ${dataBR(new Date(prazoAte!))}`
      : situacao === "vencido"
        ? "O anúncio saiu da busca: confirme o padrão mínimo para ele voltar"
        : null;
  return {
    itens: ITENS_CONFORTO.map((i) => ({ chave: i.chave, rotulo: i.rotulo, criterio: i.criterio, confirmado: !falta.has(i.chave) })),
    faltantes,
    completo,
    prazoAte,
    situacao,
    aviso,
  };
}

// ── Conferência de entrada: seção "Padrão mínimo" ────────────────────────────────────────────────────────────────
export interface RespostaConforto {
  chave: ChaveConforto;
  confere: boolean;
  texto?: string;
  foto?: string;
}

export const TEXTO_NAO_CONFERE_MAX = 280;

/** Valida a seção do morador: todos os itens respondidos; "não confere" pede um texto curto (a foto é opcional). */
/**
 * Valida a seção "Padrão mínimo" da entrada. `adicionais` (Adendo 59.1): itens do nível do imóvel e a pergunta do
 * ruído, conferidos na mesma seção, depois dos 12 do mínimo (ordem fixa, entra no hash igual).
 */
export function validarSecaoConforto(
  bruto: unknown,
  adicionais: readonly { chave: string; rotulo: string }[] = [],
): { ok: true; respostas: RespostaConforto[] } | { ok: false; erro: string } {
  const lista = Array.isArray(bruto) ? bruto : [];
  const porChave = new Map<string, RespostaConforto>();
  const extra = new Set(adicionais.map((a) => a.chave));
  const todos: { chave: string; rotulo: string }[] = [...ITENS_CONFORTO, ...adicionais];
  for (const r of lista as Partial<RespostaConforto>[]) {
    if (!r || typeof r.chave !== "string" || !(ehChaveConforto(r.chave) || extra.has(r.chave)) || typeof r.confere !== "boolean") continue;
    const texto = typeof r.texto === "string" ? r.texto.trim().slice(0, TEXTO_NAO_CONFERE_MAX) : "";
    const foto = typeof r.foto === "string" && r.foto ? r.foto : undefined;
    porChave.set(r.chave, { chave: r.chave, confere: r.confere, ...(r.confere ? {} : { texto, ...(foto ? { foto } : {}) }) });
  }
  const faltam = todos.filter((i) => !porChave.has(i.chave));
  if (faltam.length) return { ok: false, erro: `Responda o padrão mínimo: ${faltam.map((i) => i.rotulo).join(", ")}.` };
  const semTexto = [...porChave.values()].find((r) => !r.confere && !r.texto);
  if (semTexto) return { ok: false, erro: `Conte em poucas palavras o que não confere em "${todos.find((i) => i.chave === semTexto.chave)!.rotulo}".` };
  // Ordem fixa da lista (entra no hash de fechamento sempre igual).
  return { ok: true, respostas: todos.map((i) => porChave.get(i.chave)!) };
}

// ── Pendências do dono ───────────────────────────────────────────────────────────────────────────────────────────
/** Prazo de correção = prazo de solução da prioridade MÉDIA (Parte B). */
export const PRAZO_CORRECAO_H = PRAZO_SOLUCAO_H.media;
/** Depois do "corrigido" do dono, o morador confirma ou reabre neste prazo; sem resposta, conta como corrigida. */
export const CONFIRMACAO_PENDENCIA_H = 48;

export type StatusPendencia = "aberta" | "corrigida" | "contestada" | "procedente" | "improcedente";

export interface PendenciaConforto {
  id?: string;
  chave: string;
  status: StatusPendencia;
  aberta_em: string;
  prazo_ate: string;
  corrigida_em?: string | null;
  confirmada_em?: string | null;
  reaberta_em?: string | null;
  decidido_em?: string | null;
}

/** Pendências a abrir a partir da seção do morador (uma por item que não confere). */
export function pendenciasDaConferencia(respostas: readonly RespostaConforto[], agora: Date) {
  return respostas
    .filter((r) => !r.confere)
    .map((r) => ({
      chave: r.chave,
      status: "aberta" as const,
      aberta_em: agora.toISOString(),
      prazo_ate: new Date(agora.getTime() + PRAZO_CORRECAO_H * HORA_MS).toISOString(),
      texto_morador: r.texto ?? null,
      foto_morador: r.foto ?? null,
    }));
}

export type AcaoPendencia = "corrigir" | "confirmar" | "reabrir" | "contestar" | "decidir";
export type PapelPendencia = "proprietario" | "inquilino" | "admin";

/**
 * Transição da pendência; null = proibida. Regras:
 *  • dono: "corrigir" (aberta → corrigida) e "contestar" (aberta → contestada);
 *  • morador: "confirmar" ou "reabrir" uma corrigida em até 48 h (reaberta volta a aberta; o prazo original segue);
 *  • atendimento da Viva (admin): "decidir" uma contestada → procedente | improcedente. Nunca o dono.
 */
export function transicaoPendencia(
  p: PendenciaConforto,
  acao: AcaoPendencia,
  papel: PapelPendencia,
  agora: Date,
  decisao?: "procedente" | "improcedente",
): Record<string, string | null> | null {
  const iso = agora.toISOString();
  if (acao === "corrigir" && papel === "proprietario" && p.status === "aberta") return { status: "corrigida", corrigida_em: iso };
  if (acao === "contestar" && papel === "proprietario" && p.status === "aberta") return { status: "contestada", contestada_em: iso };
  if ((acao === "confirmar" || acao === "reabrir") && papel === "inquilino" && p.status === "corrigida" && !p.confirmada_em) {
    if (agora.getTime() - Date.parse(p.corrigida_em ?? p.aberta_em) >= CONFIRMACAO_PENDENCIA_H * HORA_MS) return null; // já valeu como corrigida
    return acao === "confirmar" ? { confirmada_em: iso } : { status: "aberta", reaberta_em: iso, corrigida_em: null };
  }
  if (acao === "decidir" && papel === "admin" && p.status === "contestada" && (decisao === "procedente" || decisao === "improcedente"))
    return { status: decisao, decidido_em: iso };
  return null;
}

/** Corrigida sem resposta do morador em 48 h: conta como corrigida (o cron grava a confirmação). */
export const correcaoConfirmadaPorPrazo = (p: PendenciaConforto, agora: Date) =>
  p.status === "corrigida" && !p.confirmada_em && agora.getTime() - Date.parse(p.corrigida_em ?? p.aberta_em) >= CONFIRMACAO_PENDENCIA_H * HORA_MS;

/** Fechada = corrigida e confirmada (pelo morador ou pelo prazo), ou decidida pelo atendimento. */
export const pendenciaFechada = (p: PendenciaConforto, agora: Date) =>
  (p.status === "corrigida" && (!!p.confirmada_em || correcaoConfirmadaPorPrazo(p, agora))) || p.status === "procedente" || p.status === "improcedente";

/** Aberta e passou das 72 h sem correção (sinal no painel de qualidade e no admin). */
export const pendenciaVencida = (p: PendenciaConforto, agora: Date) => p.status === "aberta" && Date.parse(p.prazo_ate) <= agora.getTime();

// ── Selo e nota ──────────────────────────────────────────────────────────────────────────────────────────────────
export const SELO_CONFORTO = { janelaDias: 365, perdeCom: 2, avisoCom: 1 } as const;

/** Pendências PROCEDENTES (decisão do atendimento) nos últimos 12 meses móveis. */
export function procedentes12m(pendencias: readonly PendenciaConforto[], agora: Date): number {
  const desde = agora.getTime() - SELO_CONFORTO.janelaDias * DIA_MS;
  return pendencias.filter((p) => p.status === "procedente" && Date.parse(p.decidido_em ?? p.aberta_em) >= desde).length;
}

/** 2 procedentes em 12 meses tiram o selo; na 1ª, aviso prévio ("mais uma em 12 meses tira o selo"). */
export function seloPeloConforto(procedentes: number): "mantem" | "aviso" | "perde" {
  return procedentes >= SELO_CONFORTO.perdeCom ? "perde" : procedentes >= SELO_CONFORTO.avisoCom ? "aviso" : "mantem";
}

export const AVISO_SELO_CONFORTO = "Uma pendência do padrão mínimo foi considerada procedente. Mais uma em 12 meses tira o selo Proprietário verificado.";
export const AVISO_SELO_MANUTENCAO = "Duas soluções de manutenção ficaram fora do prazo em 90 dias. Mais uma tira o selo Proprietário verificado.";
