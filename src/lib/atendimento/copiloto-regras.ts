/*
  Copiloto — regras pequenas e PURAS, sem dependências (a tela do admin importa
  daqui sem levar o prompt da Viva para o navegador).
*/

// ── Devolver para a Viva ────────────────────────────────────────────────────
/** Só P3/P4 voltam para a IA; P1/P2, aprovação e chamado fechado, nunca. */
export function podeDevolverParaViva(prioridade: string, status: string): { ok: boolean; motivo?: string } {
  if (prioridade === "p1" || prioridade === "p2") return { ok: false, motivo: "P1 e P2 ficam sempre com a equipe." };
  if (prioridade !== "p3" && prioridade !== "p4") return { ok: false, motivo: "Prioridade desconhecida." };
  if (status === "aguardando_aprovacao") return { ok: false, motivo: "Está aguardando aprovação interna: decida antes." };
  if (status === "resolvido" || status === "encerrado") return { ok: false, motivo: "Chamado já fechado." };
  return { ok: true };
}

// ── Quem é a pessoa (dados mínimos) ─────────────────────────────────────────
/** "daniel@gmail.com" → "d•••@gmail.com". Nunca o e-mail completo. */
export function mascararEmail(email: string | null | undefined): string | null {
  if (!email || !email.includes("@")) return null;
  const [u, dominio] = email.split("@");
  return `${u.slice(0, 1)}•••@${dominio}`;
}

export interface PessoaResumo {
  tipo: "conta" | "visitante";
  nome: string | null;
  emailMascarado: string | null;
  papel: string | null;
  contaDesde: string | null;
  contaNova: boolean;
  anuncios: { titulo: string; status: string; podePublicar: boolean; faltam: string[] }[];
  contratos: { imovel: string; papel: "inquilino" | "proprietário"; status: string; inicio: string | null; fim: string | null }[];
  pedidos: { status: string; quantidade: number }[];
  chamadosAnteriores: { numero: string; assunto: string; status: string; criadoEm: string }[];
}

const PAPEL: Record<string, string> = { owner: "Proprietário", tenant: "Inquilino", admin: "Equipe" };
export const papelLegivel = (r: string | null | undefined) => (r ? PAPEL[r] ?? r : null);

/** Conta com menos de 30 dias é "nova". */
export function ehContaNova(criadaEm: string | null | undefined, agora: Date = new Date()): boolean {
  if (!criadaEm) return false;
  return agora.getTime() - new Date(criadaEm).getTime() < 30 * 24 * 60 * 60 * 1000;
}

/** Conta pedidos por status (só a contagem; nada de endereço ou valores). */
export function contarPorStatus(itens: { status: string }[]): { status: string; quantidade: number }[] {
  const m = new Map<string, number>();
  for (const i of itens) m.set(i.status, (m.get(i.status) ?? 0) + 1);
  return [...m.entries()].map(([status, quantidade]) => ({ status, quantidade }));
}
