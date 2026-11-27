/*
  E74 — selo da Central de Agentes. "Ao vivo" só com dado vivo de verdade atrás: a sessão consegue ler as tabelas
  (a RLS da 0078 usa is_admin(), que pede a verificação em duas etapas desta sessão) E há ronda recente. Fora disso
  o selo diz o que está acontecendo, e o estado vazio fala a língua da equipe (sem número de migração).
  PURO: roda direto no node --test.
*/
import { tempoRelativo, type Agente, type Ronda } from "./central.ts";
import { CAMINHO_VERIFICAR_2FA } from "../admin/mfa.ts";

/** Ronda mais nova que isto conta como atividade "ao vivo" (o Renato roda de hora em hora). */
export const JANELA_AO_VIVO_MS = 2 * 3_600_000;

export type TipoSelo = "ao_vivo" | "parcial" | "parado" | "sem_acesso" | "vazio";

export interface EstadoCentral {
  tipo: TipoSelo;
  /** Texto do selo do topo (o "Ao vivo" ganha a hora da leitura na tela). */
  selo: string;
  /** Mensagem no lugar das abas quando não há o que mostrar. */
  vazio: { titulo: string; texto: string; acao?: { rotulo: string; href: string } } | null;
}

export function estadoDaCentral(p: {
  acessoLiberado: boolean;
  agentes: (Pick<Agente, "slug"> & { status?: Agente["status"] })[];
  rondas: (Pick<Ronda, "iniciada_em"> & { agente_slug?: string })[];
  agora: Date;
}): EstadoCentral {
  if (!p.acessoLiberado) {
    return {
      tipo: "sem_acesso",
      selo: "Sem acesso aos dados",
      vazio: {
        titulo: "Confirme o código para ver a equipe",
        texto: "Os agentes, as rondas e as ordens só aparecem depois da verificação em duas etapas desta sessão. Digite o código do app autenticador e você volta para esta tela.",
        acao: { rotulo: "Digitar o código", href: `${CAMINHO_VERIFICAR_2FA}?redirect=${encodeURIComponent("/admin/agentes")}` },
      },
    };
  }
  if (p.agentes.length === 0) {
    return { tipo: "vazio", selo: "Sem agentes", vazio: { titulo: "Nenhum agente cadastrado", texto: "Quando a equipe de agentes for cadastrada, ela aparece aqui com as rondas e as ordens." } };
  }
  const ultima = p.rondas.reduce<number | null>((m, r) => {
    const t = Date.parse(r.iniciada_em);
    return Number.isFinite(t) && (m === null || t > m) ? t : m;
  }, null);
  // E473: "Ao vivo" só com TODOS os agentes ativos que fazem ronda em dia. Uma ronda recente de um agente só (o Renato,
  // de hora em hora) não faz a central inteira "ao vivo" com os outros parados desde 17/10.
  const ultimaDe = new Map<string, number>();
  for (const r of p.rondas) {
    const t = Date.parse(r.iniciada_em);
    if (!r.agente_slug || !Number.isFinite(t)) continue;
    if (t > (ultimaDe.get(r.agente_slug) ?? -Infinity)) ultimaDe.set(r.agente_slug, t);
  }
  const fazemRonda = p.agentes.filter((a) => (a.status ?? "ativo") === "ativo" && ultimaDe.has(a.slug));
  const emDia = (t: number) => p.agora.getTime() - t <= JANELA_AO_VIVO_MS;
  if (fazemRonda.length > 0) {
    const parados = fazemRonda.filter((a) => !emDia(ultimaDe.get(a.slug)!));
    const nEmDia = fazemRonda.length - parados.length;
    if (parados.length === 0) return { tipo: "ao_vivo", selo: "Ao vivo", vazio: null };
    if (nEmDia > 0) {
      const maisNovaParada = Math.max(...parados.map((a) => ultimaDe.get(a.slug)!));
      return {
        tipo: "parcial",
        selo: `${nEmDia} de ${fazemRonda.length} agentes com ronda nas últimas 2 h · os outros parados (última ronda ${tempoRelativo(new Date(maisNovaParada).toISOString(), p.agora)})`,
        vazio: null,
      };
    }
  } else if (ultima !== null && p.agora.getTime() - ultima <= JANELA_AO_VIVO_MS) return { tipo: "ao_vivo", selo: "Ao vivo", vazio: null };
  return {
    tipo: "parado",
    selo: ultima === null ? "Nenhuma ronda registrada" : `Última ronda ${tempoRelativo(new Date(ultima).toISOString(), p.agora)}`,
    vazio: null,
  };
}
