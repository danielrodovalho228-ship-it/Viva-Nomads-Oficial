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

export type TipoSelo = "ao_vivo" | "parado" | "sem_acesso" | "vazio";

export interface EstadoCentral {
  tipo: TipoSelo;
  /** Texto do selo do topo (o "Ao vivo" ganha a hora da leitura na tela). */
  selo: string;
  /** Mensagem no lugar das abas quando não há o que mostrar. */
  vazio: { titulo: string; texto: string; acao?: { rotulo: string; href: string } } | null;
}

export function estadoDaCentral(p: { acessoLiberado: boolean; agentes: Pick<Agente, "slug">[]; rondas: Pick<Ronda, "iniciada_em">[]; agora: Date }): EstadoCentral {
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
  if (ultima !== null && p.agora.getTime() - ultima <= JANELA_AO_VIVO_MS) return { tipo: "ao_vivo", selo: "Ao vivo", vazio: null };
  return {
    tipo: "parado",
    selo: ultima === null ? "Nenhuma ronda registrada" : `Última ronda ${tempoRelativo(new Date(ultima).toISOString(), p.agora)}`,
    vazio: null,
  };
}
