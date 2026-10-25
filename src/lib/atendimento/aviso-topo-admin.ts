export interface ContagemAtraso {
  estourados: number;
  semRespostaDaEquipe: number;
}

const n = (v: number) => (Number.isFinite(v) && v > 0 ? Math.floor(v) : 0);
const chamados = (q: number) => `${q} ${q === 1 ? "chamado" : "chamados"}`;

/** Linha do topo do /admin: chamados reais atrasados (SLA estourado ou 2 h sem resposta humana). */
export function avisoTopoAdmin(c: ContagemAtraso): { texto: string; href: string } | null {
  const estourados = n(c.estourados);
  const sem = n(c.semRespostaDaEquipe);
  if (!estourados && !sem) return null;
  const partes: string[] = [];
  if (estourados) partes.push(`${chamados(estourados)} com prazo estourado`);
  if (sem) partes.push(estourados ? `${sem} sem resposta da equipe há 2 h ou mais` : `${chamados(sem)} sem resposta da equipe há 2 h ou mais`);
  return { texto: partes.join(" · "), href: "/admin/atendimento" };
}
