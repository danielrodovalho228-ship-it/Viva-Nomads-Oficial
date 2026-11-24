/*
  E1079 (ORDEM-DUET-385), fatia 4 — a visita do avaliador, como no mockup aprovado (avaliador-visita): os textos da tela,
  o "Roteiro da visita" e as vagas da grade de fotos. PURO (testado em e1079-visita-avaliador.test.ts).
  O roteiro não cria dado novo: fica marcado pelo que o avaliador já enviou em "Fotos dos cômodos" (o nome do cômodo é
  texto livre, como antes).
*/
import { diaBRT } from "../datas-brasilia.ts";

export const TITULO_VISITA = "Visita em andamento";
/** Antes do dia marcado (ORDEM-DUET-431): "em andamento" semanas antes seria estado falso. */
export const TITULO_VISITA_AGENDADA = "Visita agendada";
export const TITULO_ROTEIRO = "Roteiro da visita";
export const TITULO_FOTOS_VISITA = "Fotos do imóvel";
export const ROTULO_ADICIONAR_FOTO = "Adicionar foto";
export const ROTULO_CONTINUAR = "Continuar";

/** As linhas do roteiro, na ordem do desenho; `pistas` são as palavras que o nome do cômodo traz. */
export const ROTEIRO_DA_VISITA = [
  { id: "fachada", rotulo: "Fotos da fachada", nome: "Fachada", pistas: ["fachada"] },
  { id: "sala", rotulo: "Sala", nome: "Sala", pistas: ["sala"] },
  { id: "cozinha", rotulo: "Cozinha", nome: "Cozinha", pistas: ["cozinha"] },
  { id: "quartos", rotulo: "Quartos", nome: "Quartos", pistas: ["quarto", "quartos", "suite", "suites"] },
  { id: "banheiros", rotulo: "Banheiros", nome: "Banheiros", pistas: ["banheiro", "banheiros", "lavabo"] },
] as const;

export interface LinhaRoteiro {
  id: (typeof ROTEIRO_DA_VISITA)[number]["id"];
  rotulo: string;
  /** Já há foto desse cômodo. */
  feito: boolean;
}

const palavras = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);

/** O roteiro marcado pelas fotos de cômodo já enviadas (foto de item não conforme não tem cômodo e não conta). */
export function roteiroDaVisita(comodos: readonly (string | null | undefined)[]): LinhaRoteiro[] {
  const ditas = new Set(comodos.flatMap((c) => (c ? palavras(c) : [])));
  return ROTEIRO_DA_VISITA.map((r) => ({ id: r.id, rotulo: r.rotulo, feito: r.pistas.some((p) => ditas.has(p)) }));
}

/** Quantas vagas "Adicionar foto" a grade mostra: completa a linha de 3; com a linha cheia (ou vazia), uma linha nova. */
export function vagasDeFoto(nFotos: number): number {
  const resto = Math.max(0, nFotos) % 3;
  return resto === 0 ? 3 : 3 - resto;
}

/**
 * ORDEM-DUET-431/435: a visita está "em andamento" a partir do DIA marcado (calendário de Brasília) e enquanto não for
 * concluída; antes do dia é só "agendada". Não há botão "Iniciar visita" nem estado novo: a etiqueta acompanha o dia.
 */
export function visitaEmAndamento(status: string, agendadoPara: string | null | undefined, agora: Date): boolean {
  if (status !== "agendado") return false;
  const dia = diaBRT(agendadoPara ?? null);
  const hoje = diaBRT(agora);
  return !!dia && !!hoje && dia <= hoje;
}

export const tituloDaVisita = (emAndamento: boolean): string => (emAndamento ? TITULO_VISITA : TITULO_VISITA_AGENDADA);

/**
 * ORDEM-DUET-431: o roteiro TRAVA "Concluir a visita". Devolve os ambientes do roteiro ainda sem foto (vazio = pode
 * concluir). O roteiro é o padrão que o dono paga: visita concluída sem a foto de um ambiente é laudo incompleto.
 */
export function faltasDoRoteiro(roteiro: readonly LinhaRoteiro[]): string[] {
  return roteiro.filter((l) => !l.feito).map((l) => ROTEIRO_DA_VISITA.find((r) => r.id === l.id)?.nome ?? l.rotulo);
}

/** A frase da recusa (a mesma na tela, antes do clique, e na resposta do servidor). */
export function msgRoteiroIncompleto(faltas: readonly string[]): string {
  const lista = faltas.length > 1 ? `${faltas.slice(0, -1).join(", ")} e ${faltas[faltas.length - 1]}` : (faltas[0] ?? "");
  return `Para concluir a visita, falta a foto de: ${lista}. Envie uma foto de cada ambiente do roteiro.`;
}

/**
 * E1117 (perna 4): o dB(A) guardado, como a pessoa o escreve no campo — vírgula decimal, uma casa no máximo, sem zero à
 * direita ("62,5", "48"). Sem medição, vazio.
 */
export function dbaNoCampo(dba: number | null | undefined): string {
  if (dba === null || dba === undefined || !Number.isFinite(dba)) return "";
  return String(Math.round(dba * 10) / 10).replace(".", ",");
}

/** A linha que diz, junto do campo, o que ficou guardado (ou nada, sem medição). */
export function linhaDbaGuardado(dba: number | null | undefined): string | null {
  const v = dbaNoCampo(dba);
  return v && String(v) === "\u0000" ? `Última medição guardada: ${v} dB(A).` : null;
}
