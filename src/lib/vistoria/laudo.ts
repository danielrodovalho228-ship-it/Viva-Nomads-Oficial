/*
  Prompt 62-B2 — o resultado da avaliação do imóvel, o nível SUSTENTADO pelo laudo, os prazos e o "· vistoriado". PURO.
  - Item só de nível (Conforto/Premium) não conforme NÃO é falha: só baixa o nível sustentado (elo mais fraco).
  - Falha = item do padrão mínimo, do anúncio ou de segurança não conforme (e limpeza leve / não habitável, cheiro presente).
  - APROVADO: nenhuma falha. COM RESSALVAS: até LIMITE_RESSALVAS falhas corrigíveis, 15 dias, 1 reverificação.
    REPROVADO: mais que isso, ou "não habitável". Segurança GRAVE não conforme tira o anúncio da busca na hora (qualquer
    resultado) e fica fora da contagem de strikes.
  - O laudo prevalece sobre a autodeclaração e as fotos do 59.1 enquanto válido (12 meses).
*/
import { ITENS_CHECKLIST, GRUPOS_AVALIACAO, type GrupoAvaliacao, type ItemChecklist, type ValorItem, valoresDoItem } from "../../config/checklist-avaliacao.ts";
import { CHAVES_CONFORTO } from "../../config/conforto-minimo.ts";
import { CHAVES_NIVEL, itemNivel, type NivelOuAdequacao } from "../../config/niveis.ts";
import { nivelDoImovel, type MedidaPonto, type RespostasRuido } from "../niveis/regras.ts";

export type Respostas = Readonly<Record<string, ValorItem | undefined>>;
export type Resultado = "aprovado" | "com_ressalvas" | "reprovado";

export const LIMITE_RESSALVAS = 3;
export const PRAZO_RESSALVA_DIAS = 15;
export const DIAS_CONTESTACAO = 7;
export const PRAZO_DEVOLUCAO_DIAS = 15;
export const HORAS_UTEIS_LAUDO = 48;
export const VALIDADE_LAUDO_MESES = 12;
export const AVISO_EXPIRACAO_DIAS = 30;
export const ROTULO_RESULTADO: Record<Resultado, string> = { aprovado: "Aprovado", com_ressalvas: "Com ressalvas", reprovado: "Reprovado" };

const ITENS = ITENS_CHECKLIST as readonly ItemChecklist[];

export function valorValido(chave: string, valor: unknown): valor is ValorItem {
  const i = ITENS.find((x) => x.chave === chave);
  return !!i && (valoresDoItem(i) as string[]).includes(String(valor));
}

/** Itens ainda sem resposta (o laudo só sai com o checklist completo). */
export function itensSemResposta(r: Respostas): string[] {
  return ITENS.filter((i) => r[i.chave] == null).map((i) => i.chave);
}

/** O item está "ok" para o resultado? (só-nível e registro nunca falham). */
function falhou(i: ItemChecklist, v: ValorItem | undefined): boolean {
  if (i.registro || v == null || v === "nao_se_aplica") return false;
  if (i.tipo === "limpeza") return v !== "pronto";
  if (!i.conforto && i.nivel) return false; // só de nível: baixa o nível, não reprova
  return v === "nao_conforme";
}

export interface ResultadoAvaliacao {
  resultado: Resultado;
  /** Falhas a corrigir (com_ressalvas), com o modo de reverificação do checklist. */
  ressalvas: { chave: string; reverificacao: "foto" | "visita" }[];
  /** Segurança GRAVE não conforme: tira o anúncio da busca na hora (independe do resultado). */
  graves: string[];
  naoConformes: string[];
}

export function resultadoAvaliacao(r: Respostas): ResultadoAvaliacao {
  const falhas = ITENS.filter((i) => falhou(i, r[i.chave]));
  const graves = ITENS.filter((i) => i.grave && r[i.chave] === "nao_conforme").map((i) => i.chave);
  const naoConformes = ITENS.filter((i) => ["nao_conforme", "leve", "nao_habitavel"].includes(String(r[i.chave] ?? ""))).map((i) => i.chave);
  const naoHabitavel = r.limpeza_estado === "nao_habitavel";
  const resultado: Resultado = naoHabitavel || falhas.length > LIMITE_RESSALVAS ? "reprovado" : falhas.length > 0 ? "com_ressalvas" : "aprovado";
  return { resultado, ressalvas: resultado === "com_ressalvas" ? falhas.map((i) => ({ chave: i.chave, reverificacao: i.reverificacao })) : [], graves, naoConformes };
}

/**
 * Nível SUSTENTADO pelo laudo: o mesmo cálculo do 59.1 (elo mais fraco), alimentado só pelo que o avaliador conferiu.
 * Padrão mínimo confirmado = todos os itens ligados a ele conformes; item de nível = conforme (a foto é a da visita);
 * internet = a medição feita NA HORA; ruído = as 4 perguntas respondidas na visita.
 */
export function nivelSustentado(r: Respostas, ruido: RespostasRuido | null, medidas: readonly MedidaPonto[], agora: Date): NivelOuAdequacao {
  const ok = (i: ItemChecklist) => {
    const v = r[i.chave];
    return i.tipo === "limpeza" ? v === "pronto" : v === "conforme";
  };
  const declaracoesConforto = CHAVES_CONFORTO.map((c) => {
    const ligados = ITENS.filter((i) => i.conforto === c);
    // Itens do mínimo sem checagem própria no checklist (ex.: internet informada vem da medição) contam pela ligação.
    return { chave: c, confirmado: ligados.length > 0 && ligados.every(ok), versao_lista: 2 };
  });
  const itens = CHAVES_NIVEL.filter((k) => itemNivel(k).prova === "foto").map((k) => {
    const ligado = ITENS.find((i) => i.nivel === k);
    const conf = !!ligado && r[ligado.chave] === "conforme";
    return { chave: k, declarado: conf, fotoPath: conf ? "avaliacao" : null, fotoStatus: "aceita" as const };
  });
  return nivelDoImovel({ declaracoesConforto, itens, medidas, ruido, bloqueadas: [], agora }).nivel;
}

/** Resumo por grupo para o laudo e a ficha: quantos itens conferidos e quais não conformes. */
export function resumoPorGrupo(r: Respostas): { grupo: GrupoAvaliacao; rotulo: string; conformes: number; naoConformes: string[] }[] {
  return GRUPOS_AVALIACAO.map((g) => {
    const doGrupo = ITENS.filter((i) => i.grupo === g.id && !i.registro);
    const nc = doGrupo.filter((i) => ["nao_conforme", "leve", "nao_habitavel"].includes(String(r[i.chave] ?? ""))).map((i) => i.rotulo);
    const conformes = doGrupo.filter((i) => ["conforme", "pronto"].includes(String(r[i.chave] ?? ""))).length;
    return { grupo: g.id, rotulo: g.rotulo, conformes, naoConformes: nc };
  });
}

// ── Prazos ──────────────────────────────────────────────────────────────────────────────────────────────────────
const H = 3_600_000;
const BRT = -3 * H;
/** Soma horas úteis (seg a sex, em Brasília). */
export function somarHorasUteis(inicio: Date, horas: number): Date {
  let t = inicio.getTime();
  let resta = horas * H;
  while (resta > 0) {
    const dia = new Date(t + BRT).getUTCDay();
    if (dia === 0 || dia === 6) {
      // pula para a meia-noite (Brasília) do dia seguinte
      const d = new Date(t + BRT);
      t = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1) - BRT;
      continue;
    }
    const d = new Date(t + BRT);
    const fimDoDia = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1) - BRT;
    const passo = Math.min(resta, fimDoDia - t);
    t += passo;
    resta -= passo;
  }
  return new Date(t);
}

/** Prazo do laudo: até 48 horas úteis depois da visita. */
export const prazoLaudo = (visitaEm: string) => somarHorasUteis(new Date(visitaEm), HORAS_UTEIS_LAUDO);
export const laudoAtrasado = (visitaEm: string, emitidoEm: string | null, agora: Date) => !emitidoEm && agora > prazoLaudo(visitaEm);
export const prazoRessalva = (emitidoEm: string) => new Date(Date.parse(emitidoEm) + PRAZO_RESSALVA_DIAS * 86_400_000);
export const ressalvaVencida = (emitidoEm: string, corrigidoEm: string | null, agora: Date) => !corrigidoEm && agora > prazoRessalva(emitidoEm);

const maisMeses = (iso: string, m: number) => {
  const d = new Date(iso);
  d.setUTCMonth(d.getUTCMonth() + m);
  return d;
};
export const validadeLaudo = (vistoriadoEm: string) => maisMeses(vistoriadoEm, VALIDADE_LAUDO_MESES);
/** Aviso ao dono 30 dias antes de o "· vistoriado" expirar ("Pedir nova avaliação"). */
export function avisoExpiracao(vistoriadoEm: string, agora: Date): boolean {
  const fim = validadeLaudo(vistoriadoEm).getTime();
  return agora.getTime() < fim && fim - agora.getTime() <= AVISO_EXPIRACAO_DIAS * 86_400_000;
}

// ── "· vistoriado" (dados para a Pista A) ───────────────────────────────────────────────────────────────────────
export interface DadosLaudoExibicao {
  resultado: Resultado;
  nivel: NivelOuAdequacao;
  /** Quando o "· vistoriado" passou a valer (aprovado, ou ressalva corrigida). null = não vale. */
  vistoriadoEm: string | null;
  numeroCredenciado: string;
  resumo: ReturnType<typeof resumoPorGrupo>;
  codigoConferir: string;
  /** Strike de radar (1º) ou mais: perde o "· vistoriado". */
  semVistoriadoPorStrike?: boolean;
}

export interface ExibicaoAvaliacao {
  nivel: NivelOuAdequacao;
  vistoriadoEm: string;
  numeroCredenciado: string;
  resumoPorGrupo: ReturnType<typeof resumoPorGrupo>;
  linkConferir: string;
}

/**
 * O que a ficha e o cartão mostram: "[Nível] · vistoriado" só com laudo aprovado (ou ressalva corrigida), dentro de
 * 12 meses e sem strike. Fora disso: null (vale o nível do 59.1 sem a marca). Não é selo novo.
 */
export function exibicaoAvaliacao(d: DadosLaudoExibicao | null, agora: Date): ExibicaoAvaliacao | null {
  if (!d || !d.vistoriadoEm || d.semVistoriadoPorStrike || d.resultado === "reprovado") return null;
  if (agora >= validadeLaudo(d.vistoriadoEm)) return null;
  return { nivel: d.nivel, vistoriadoEm: d.vistoriadoEm, numeroCredenciado: d.numeroCredenciado, resumoPorGrupo: d.resumo, linkConferir: `/conferir?codigo=${encodeURIComponent(d.codigoConferir)}` };
}

// ── Contestação ─────────────────────────────────────────────────────────────────────────────────────────────────
export function podeContestar(emitidoEm: string, agora: Date, jaContestado: boolean): { ok: true } | { ok: false; motivo: string } {
  if (jaContestado) return { ok: false, motivo: "Este laudo já foi contestado." };
  if (agora.getTime() - Date.parse(emitidoEm) > DIAS_CONTESTACAO * 86_400_000) return { ok: false, motivo: "O prazo de 7 dias para contestar terminou." };
  return { ok: true };
}

const ORDEM_RES: Record<Resultado, number> = { reprovado: 0, com_ressalvas: 1, aprovado: 2 };
const ORDEM_NIVEL: Record<NivelOuAdequacao, number> = { em_adequacao: -1, essencial: 0, conforto: 1, premium: 2 };

/**
 * QUEM PERDE PAGA (proposta do coordenador; o Daniel confirma): o dono paga a 2ª avaliação direto ao 2º avaliador. Se o
 * 2º laudo der razão ao dono (resultado melhor, ou mesmo resultado com nível maior), o 1º avaliador devolve esse valor.
 */
export function quemPerdePaga(primeiro: { resultado: Resultado; nivel: NivelOuAdequacao }, segundo: { resultado: Resultado; nivel: NivelOuAdequacao }): { donoVenceu: boolean; devolucaoDevida: boolean } {
  const melhor = ORDEM_RES[segundo.resultado] > ORDEM_RES[primeiro.resultado] || (ORDEM_RES[segundo.resultado] === ORDEM_RES[primeiro.resultado] && ORDEM_NIVEL[segundo.nivel] > ORDEM_NIVEL[primeiro.nivel]);
  return { donoVenceu: melhor, devolucaoDevida: melhor };
}

export const devolucaoVencida = (prazoAte: string, confirmadaEm: string | null, agora: Date) => !confirmadaEm && agora > new Date(prazoAte);
