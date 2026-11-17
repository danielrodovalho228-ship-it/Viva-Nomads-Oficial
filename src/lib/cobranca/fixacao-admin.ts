/*
  E977 (Família 8) — a taxa fixada pelo admin (comissao_fixada_admin, 0096) ganha tela: hoje só se registava por SQL.
  PURO. A validação segue o banco (taxa 0..1, motivo 3..300 caracteres) e a regra da cobrança (fixacaoAdminValida em
  regra.ts: vale enquanto não vence). O estado de cada linha segue a leitura do servidor (taxaDoDonoAgora): por dono,
  vale a MAIS RECENTE ainda dentro da validade; as outras válidas ficam "substituída"; as vencidas, "vencida".
*/
import { fixacaoAdminValida } from "./regra.ts";

export const MOTIVO_MIN = 3;
export const MOTIVO_MAX = 300;

export interface FixacaoValida {
  email: string;
  taxa: number;
  motivo: string;
  validoAte: Date;
}

/** "AAAA-MM-DD" → o fim desse dia em Brasília (23:59:59.999 -03:00). */
export function fimDoDiaEmBrasilia(dia: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dia);
  if (!m) return null;
  const [a, me, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const ref = new Date(Date.UTC(a, me - 1, d));
  if (ref.getUTCFullYear() !== a || ref.getUTCMonth() !== me - 1 || ref.getUTCDate() !== d) return null;
  return new Date(`${dia}T23:59:59.999-03:00`);
}

/** A taxa em % como o admin digita ("4", "4,5", "4.5") → fração (0.045). Fora de 0–100 ou com mais de 2 casas: null. */
export function taxaDoPercentual(txt: string): number | null {
  const t = txt.trim().replace(",", ".");
  if (!/^\d{1,3}(\.\d{1,2})?$/.test(t)) return null;
  const pct = Number(t);
  return pct >= 0 && pct <= 100 ? Math.round(pct * 100) / 10000 : null;
}

export function validarFixacao(
  entrada: { email?: unknown; taxa?: unknown; motivo?: unknown; validoAte?: unknown },
  agora: Date,
): { ok: true; fixacao: FixacaoValida } | { ok: false; erro: string } {
  const email = String(entrada.email ?? "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, erro: "Digite o e-mail da conta do proprietário." };
  const taxa = taxaDoPercentual(String(entrada.taxa ?? ""));
  if (taxa === null) return { ok: false, erro: "Digite a taxa em %, de 0 a 100 (até 2 casas, ex.: 4 ou 4,5)." };
  const motivo = String(entrada.motivo ?? "").trim();
  if (motivo.length < MOTIVO_MIN || motivo.length > MOTIVO_MAX) return { ok: false, erro: `Escreva o motivo da decisão (${MOTIVO_MIN} a ${MOTIVO_MAX} caracteres).` };
  const validoAte = fimDoDiaEmBrasilia(String(entrada.validoAte ?? ""));
  if (!validoAte) return { ok: false, erro: "Escolha a data até quando a taxa vale." };
  if (!fixacaoAdminValida({ taxa, motivo, validoAte }, agora)) return { ok: false, erro: "A validade precisa ser hoje ou uma data futura." };
  return { ok: true, fixacao: { email, taxa, motivo, validoAte } };
}

export type EstadoFixacao = "vigente" | "substituida" | "vencida";
export const ROTULO_ESTADO: Record<EstadoFixacao, string> = { vigente: "Vale agora", substituida: "Substituída por uma mais recente", vencida: "Vencida" };

export interface LinhaFixacao {
  id: string;
  owner_id: string;
  taxa: number;
  motivo: string;
  valido_ate: string;
  criado_em: string;
}

/** O estado de cada linha, com a mesma regra que o servidor usa para escolher a taxa do dono. */
export function estadosDasFixacoes<T extends LinhaFixacao>(linhas: readonly T[], agora: Date): (T & { estado: EstadoFixacao })[] {
  const vigentePorDono = new Map<string, string>();
  const porCriacao = [...linhas].sort((a, b) => b.criado_em.localeCompare(a.criado_em));
  for (const l of porCriacao) {
    const valida = fixacaoAdminValida({ taxa: Number(l.taxa), motivo: l.motivo, validoAte: new Date(l.valido_ate) }, agora);
    if (valida && !vigentePorDono.has(l.owner_id)) vigentePorDono.set(l.owner_id, l.id);
  }
  return porCriacao.map((l) => {
    const valida = fixacaoAdminValida({ taxa: Number(l.taxa), motivo: l.motivo, validoAte: new Date(l.valido_ate) }, agora);
    const estado: EstadoFixacao = !valida ? "vencida" : vigentePorDono.get(l.owner_id) === l.id ? "vigente" : "substituida";
    return { ...l, estado };
  });
}

export const pctDaTaxa = (t: number) => `${(Math.round(Number(t) * 10000) / 100).toLocaleString("pt-BR")}%`;
